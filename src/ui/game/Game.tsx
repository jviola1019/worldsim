import { powerSetOf } from '../../powers/powerSet';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Simulation } from '../../sim/simulation';
import { SPEEDS } from '../../sim/simulation';
import { Renderer } from '../../rendering/renderer';
import { InputHandler } from '../input';
import { getAtlas, Icon } from '../shared';
import { POWER_BY_ID, applyPower, endStroke, undo } from '../../powers/powers';
import type { Prefs } from '../screens/SettingsScreen';
import { store } from '../App';
import { TopBar } from './TopBar';
import { Dock } from './Dock';
import { Inspector, type Selection } from '../panels/Inspector';
import { HistoryPanel } from '../panels/HistoryPanel';
import { StatsPanel } from '../panels/StatsPanel';
import { LawsPanel } from '../panels/LawsPanel';
import { MenuPanel } from '../panels/MenuPanel';
import { favoritePosition } from '../../sim/favorites';
import type { Favorite } from '../../sim/types';
import { OverlayPanel } from '../panels/OverlayPanel';
import { CivListPanel } from '../panels/CivListPanel';
import { FeedPanel, PostCard } from '../panels/FeedPanel';
import { postFor, isPostable, type FeedPost } from '../../history/feed';
import type { HistoryEvent } from '../../sim/types';
import { TILE } from '../../rendering/camera';
import { sound } from '../audio';
import { Tutorial } from './Tutorial';
import { scenarioObjectives } from '../../scenarios/scenarios';
import { savePrefs } from '../screens/SettingsScreen';

export type Sheet = 'none' | 'inspect' | 'history' | 'stats' | 'laws' | 'menu' | 'overlays' | 'civs' | 'feed';

interface Toast {
  id: number;
  text: string;
  warn?: boolean;
}

export function Game({ sim, prefs, exit, replaceSim }: { sim: Simulation; prefs: Prefs; exit: () => void; replaceSim: (s: Simulation) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const [speed, setSpeed] = useState(1);
  const [tool, setTool] = useState('inspect');
  const [brushSize, setBrushSize] = useState(2);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [following, setFollowing] = useState<Selection | null>(null);
  const followRef = useRef<Selection | null>(null);
  followRef.current = following;
  useEffect(() => { setFollowing(null); }, [sim]); // a loaded or branched world: ids belong to another history
  const [, setUi] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ticker, setTicker] = useState<FeedPost | null>(null);
  const [tutorial, setTutorial] = useState(!prefs.tutorialSeen);
  const [objectivesDone, setObjectivesDone] = useState<string[]>([]);
  const stateRef = useRef({ speed, tool, brushSize, selection, lastPaint: -1, sheet });
  stateRef.current = { ...stateRef.current, speed, tool, brushSize, selection, sheet };
  const objectives = useMemo(() => scenarioObjectives(sim.w.meta.scenario), [sim]);
  sound.enabled = prefs.sound;

  const toast = (text: string, warn = false) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, warn }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  // renderer + loop + input
  useEffect(() => {
    const canvas = canvasRef.current!;
    const r = new Renderer(canvas, sim, getAtlas());
    renderer.current = r;
    r.showLabels = prefs.labels;
    const resize = () => {
      r.resize(window.innerWidth, window.innerHeight, Math.min(3, window.devicePixelRatio || 1));
    };
    resize();
    r.cam.fitWorld(sim.w.map.w, sim.w.map.h);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    const selectAt = (sx: number, sy: number) => {
      const [tx, ty] = r.cam.screenToTile(sx, sy);
      // round 9: up close, a tap on one of the real people drawn opens that person
      const pid = r.personAt(sx, sy);
      const sel: Selection | null = pid !== null ? { kind: 'person', id: pid } : pickEntity(sim, tx, ty);
      setSelection(sel);
      r.selection = sel && sel.kind !== 'tile' && sel.kind !== 'civ' ? { kind: sel.kind, id: sel.id } : null;
      if (sel) {
        setSheet('inspect');
        if (sel.kind === 'civ') r.overlay.focusCiv = sel.id;
      }
      sound.play('click');
    };
    const applyAt = (sx: number, sy: number) => {
      const st = stateRef.current;
      const p = POWER_BY_ID[st.tool];
      if (!p) return;
      const [tx, ty] = r.cam.screenToTile(sx, sy);
      const civSel = st.selection?.kind === 'civ' ? st.selection.id : st.selection?.kind === 'settlement' ? sim.w.settlements.get(st.selection.id)?.civId ?? 0 : 0;
      const msg = applyPower(sim, p.id, tx, ty, p.kind === 'brush' ? st.brushSize : 1, { selectedCiv: civSel });
      if (msg) toast(msg, true);
      else sound.play(p.destructive ? 'boom' : 'power');
    };
    const input = new InputHandler(canvas, r.cam, {
      toolKind: () => {
        const p = POWER_BY_ID[stateRef.current.tool];
        return p ? p.kind : 'none';
      },
      onTap: (sx, sy) => {
        const p = POWER_BY_ID[stateRef.current.tool];
        if (p && p.kind === 'tap') applyAt(sx, sy);
        else selectAt(sx, sy);
      },
      onLongPress: (sx, sy) => selectAt(sx, sy),
      onPaint: (sx, sy, first) => {
        const st = stateRef.current;
        const p = POWER_BY_ID[st.tool];
        if (!p) return;
        const [tx, ty] = r.cam.screenToTile(sx, sy);
        const key = ty * sim.w.map.w + tx;
        if (first) {
          undo.begin();
          stateRef.current.lastPaint = -1;
        }
        if (!p.continuous && key === stateRef.current.lastPaint) return;
        stateRef.current.lastPaint = key;
        applyAt(sx, sy);
      },
      onStrokeEnd: (cancelled) => {
        undo.end();
        if (cancelled) undo.undo(sim); // undo re-derives rivers itself
        else endStroke(sim, stateRef.current.tool);
      },
      onHover: (sx, sy, visible) => {
        const p = POWER_BY_ID[stateRef.current.tool];
        const [tx, ty] = r.cam.screenToTile(sx, sy);
        r.brush = { x: tx, y: ty, r: p?.kind === 'brush' ? stateRef.current.brushSize : 0.6, color: p?.destructive ? '#e2654e' : '#5fd0c4', visible: visible && !!p };
      },
      onCamera: (panned) => { if (panned) setFollowing(null); }, // dragging the map stops following; zooming does not
    });
    const unsub = sim.onEvent((e) => {
      // the newest world-level story appears as a post in its own medium (replaces the old headline ticker)
      if (isPostable(e, 0)) setTicker(postFor(sim, e));
      if (e.importance >= 4) sound.play('event');
    });
    let last = performance.now();
    let uiTimer = 0;
    let raf = 0;
    let saveTimer = 0;
    let faulted = false;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = stateRef.current;
      try {
        if (!faulted) sim.advance(dt * 1000, SPEEDS[st.speed], 9);
      } catch (err) {
        // never freeze silently, and never autosave a world in an inconsistent state
        faulted = true;
        st.speed = 0;
        setSpeed(0);
        toast(`The simulation stopped on an error and was paused (${err instanceof Error ? err.message : String(err)}). Your autosaves are untouched.`, true);
        console.error(err);
      }
      // round 9: follow camera
      const f = followRef.current;
      if (f) {
        const pos = favoritePosition(sim.w, { kind: f.kind as Favorite['kind'], id: f.id, label: '' });
        if (!pos) setFollowing(null);
        else {
          const k = Math.min(1, dt * 6);
          r.cam.x += ((pos.x + 0.5) * TILE - r.cam.x) * k;
          r.cam.y += ((pos.y + 0.5) * TILE - r.cam.y) * k;
        }
      }
      r.frame(dt);
      uiTimer += dt;
      if (uiTimer > 0.25) {
        uiTimer = 0;
        setUi((x) => x + 1);
      }
      saveTimer += dt;
      if (!faulted && prefs.autosaveMinutes > 0 && saveTimer > prefs.autosaveMinutes * 60 && store.available && st.speed > 0) {
        saveTimer = 0;
        sim.syncRng();
        store.autosave(sim.w, r.thumbnail()).catch(() => toast('Autosave failed — storage may be full', true));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      input.dispose();
      unsub();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [sim]);

  useEffect(() => {
    if (renderer.current) renderer.current.showLabels = prefs.labels;
  }, [prefs.labels]);

  // reduce motion (setting or OS): the map's ambient animation slows to a crawl, people and traffic stop
  useEffect(() => {
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const apply = () => { if (renderer.current) renderer.current.reduceMotion = prefs.reduceMotion || !!mq?.matches; };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [prefs.reduceMotion, sim]);

  // ticker auto-hide
  useEffect(() => {
    if (!ticker) return;
    const t = setTimeout(() => setTicker(null), 7000);
    return () => clearTimeout(t);
  }, [ticker]);

  // scenario objectives (checked a few times per second via UI refresh)
  useEffect(() => {
    for (const o of objectives) {
      if (!objectivesDone.includes(o.id) && o.check(sim)) {
        setObjectivesDone((d) => [...d, o.id]);
        toast(`Objective met: ${o.label}`);
      }
    }
  });

  /** Select from a panel: the inspector, the map outline and the nation focus all follow. */
  const select = (s: Selection | null) => {
    setSelection(s);
    const r = renderer.current;
    if (!r) return;
    r.selection = s && s.kind !== 'tile' && s.kind !== 'civ' ? { kind: s.kind, id: s.id } : null;
    if (s?.kind === 'civ') r.overlay.focusCiv = s.id;
  };

  const focusOn = (x: number, y: number, zoomIn = true) => {
    const r = renderer.current;
    if (!r || x < 0) return;
    setFollowing(null); // a jump elsewhere ends following, or the camera would drift straight back
    r.cam.x = (x + 0.5) * TILE;
    r.cam.y = (y + 0.5) * TILE;
    if (zoomIn) r.cam.zoom = Math.max(r.cam.zoom, 2.2);
    r.highlight = { x, y, t: 3 };
  };

  const r = renderer.current;
  const pickTool = (id: string) => {
    setTool(id);
    if (id === 'inspect') r && (r.brush.visible = false);
  };

  return (
    <div>
      <canvas ref={canvasRef} class="canvas" aria-label="World map" />
      <TopBar sim={sim} speed={speed} setSpeed={setSpeed} openSheet={(s) => setSheet(sheet === s ? 'none' : s)} sheet={sheet} objectives={objectives} done={objectivesDone} />
      {ticker && prefs.newspaper && sheet !== 'feed' && (
        <div class="ticker feed-strip" role="status" onClick={() => { focusOn(ticker.x, ticker.y, false); setSheet('feed'); }}>
          <PostCard post={{ ...ticker, replies: ticker.replies.slice(0, 1) }} sim={sim} focus={(x, y) => focusOn(x, y)} />
        </div>
      )}
      {powerSetOf(sim.w.meta.settings) === 'none' ? (
        <div class="observer-badge" role="status">Observer mode: history unfolds on its own (no god powers)</div>
      ) : (
      <Dock
        settings={sim.w.meta.settings}
        noPeople={sim.w.civs.size === 0 && sim.w.bands.size === 0}
        tool={tool}
        setTool={pickTool}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        openLaws={() => setSheet('laws')}
        canUndo={undo.canUndo}
        onUndo={() => {
          if (undo.undo(sim)) {
            toast('Undid the last terrain edit');
          }
        }}
      />
      )}
      <div class="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} class={'toast' + (t.warn ? ' warn' : '')}>
            {t.text}
          </div>
        ))}
      </div>
      {sheet === 'inspect' && selection && <Inspector sim={sim} sel={selection} setSel={select} close={() => { setSheet('none'); if (r) r.selection = null; }} focus={focusOn} follow={setFollowing} following={following} />}
      {sheet === 'history' && <HistoryPanel sim={sim} close={() => setSheet('none')} focus={focusOn} selectedCiv={selection?.kind === 'civ' ? selection.id : 0} openCiv={(id) => { setSelection({ kind: 'civ', id }); setSheet('inspect'); }} />}
      {sheet === 'stats' && <StatsPanel sim={sim} close={() => setSheet('none')} />}
      {sheet === 'feed' && <FeedPanel sim={sim} close={() => setSheet('none')} focus={focusOn} selectedCiv={selection?.kind === 'civ' ? selection.id : 0} />}
      {sheet === 'laws' && <LawsPanel sim={sim} close={() => setSheet('none')} />}
      {sheet === 'overlays' && r && <OverlayPanel renderer={r} close={() => setSheet('none')} />}
      {sheet === 'civs' && <CivListPanel sim={sim} close={() => setSheet('none')} open={(id) => { setSelection({ kind: 'civ', id }); setSheet('inspect'); const civ = sim.w.civs.get(id); const cap = civ ? sim.w.settlements.get(civ.capital) : undefined; if (cap) focusOn(cap.x, cap.y, false); }} />}
      {sheet === 'menu' && r && <MenuPanel sim={sim} renderer={r} close={() => setSheet('none')} exit={exit} toast={toast} replaceSim={replaceSim} openFavorite={(f) => { const pos = favoritePosition(sim.w, f); if (pos) focusOn(pos.x, pos.y); select({ kind: f.kind, id: f.id }); setSheet('inspect'); }} />}
      {tutorial && (
        <Tutorial
          done={() => {
            setTutorial(false);
            prefs.tutorialSeen = true;
            savePrefs(prefs);
          }}
        />
      )}
      {tool !== 'inspect' && POWER_BY_ID[tool] && (
        <div class="hint" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(150px + var(--safe-b))', zIndex: 11 }}>
          {POWER_BY_ID[tool].kind === 'brush' ? 'Drag with one finger to paint · two fingers move the map' : 'Tap the map to use · drag to move'}
        </div>
      )}
      <span hidden>
        <Icon id="ico.info" size={1} />
      </span>
    </div>
  );
}

/** Find the most relevant entity at a tile. */
export function pickEntity(sim: Simulation, tx: number, ty: number): Selection | null {
  const w = sim.w;
  const m = w.map;
  if (!m.inBounds(tx, ty)) return null;
  for (const a of w.armies.values()) if ((a.x - tx - 0.5) ** 2 + (a.y - ty - 0.5) ** 2 < 1.5) return { kind: 'army', id: a.id };
  for (const b of w.bands.values()) if ((b.x - tx - 0.5) ** 2 + (b.y - ty - 0.5) ** 2 < 2) return { kind: 'band', id: b.id };
  const sid = m.settle[m.idx(tx, ty)];
  if (sid && w.settlements.has(sid)) return { kind: 'settlement', id: sid };
  for (const h of w.herds.values()) if ((h.x - tx - 0.5) ** 2 + (h.y - ty - 0.5) ** 2 < 1.2) return { kind: 'herd', id: h.id };
  return { kind: 'tile', id: m.idx(tx, ty) };
}
