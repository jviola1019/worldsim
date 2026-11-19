export interface Prefs {
  sound: boolean;
  labels: boolean;
  autosaveMinutes: number;
  tutorialSeen: boolean;
  newspaper: boolean;
  /** Reduce motion: no UI transitions, map ambience frozen (also follows the OS setting). */
  reduceMotion: boolean;
}

const KEY = 'epoch-prefs';

export const DEFAULT_PREFS: Readonly<Prefs> = { sound: true, labels: true, autosaveMinutes: 3, tutorialSeen: false, newspaper: true, reduceMotion: false };
export const AUTOSAVE_CHOICES = [0, 1, 3, 10] as const;

/**
 * Stored preferences are untrusted (another script on the origin, an extension or a hand edit
 * can change them): keep only known keys of the right type, so a bad value can neither crash
 * the game nor add unexpected properties.
 */
export function sanitizePrefs(raw: unknown): Prefs {
  const p: Prefs = { ...DEFAULT_PREFS };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return p;
  const r = raw as Record<string, unknown>;
  for (const k of ['sound', 'labels', 'tutorialSeen', 'newspaper', 'reduceMotion'] as const) {
    if (Object.prototype.hasOwnProperty.call(r, k) && typeof r[k] === 'boolean') p[k] = r[k] as boolean;
  }
  const m = r.autosaveMinutes;
  if (Object.prototype.hasOwnProperty.call(r, 'autosaveMinutes') && (AUTOSAVE_CHOICES as readonly unknown[]).includes(m)) p.autosaveMinutes = m as number;
  return p;
}

export function loadPrefs(): Prefs {
  try {
    const text = localStorage.getItem(KEY);
    return sanitizePrefs(text && text.length <= 4096 ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: preferences last for this session only */
  }
}

export function SettingsScreen({ back, prefs, setPrefs }: { back: () => void; prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  const update = (patch: Partial<Prefs>) => {
    const p = { ...prefs, ...patch };
    setPrefs(p);
    savePrefs(p);
  };
  return (
    <main class="screen">
      <div class="page">
        <div class="back-row">
          <button class="btn small" onClick={back}>Back</button>
          <h1>Settings</h1>
        </div>
        <section class="fieldset">
          <label class="toggle">
            Sound effects
            <input type="checkbox" checked={prefs.sound} onChange={(e) => update({ sound: (e.target as HTMLInputElement).checked })} />
          </label>
          <label class="toggle">
            Settlement & nation names on the map
            <input type="checkbox" checked={prefs.labels} onChange={(e) => update({ labels: (e.target as HTMLInputElement).checked })} />
          </label>
          <label class="toggle">
            Reduce motion
            <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => update({ reduceMotion: (e.target as HTMLInputElement).checked })} />
          </label>
          <label class="toggle">
            Headlines for major events
            <input type="checkbox" checked={prefs.newspaper} onChange={(e) => update({ newspaper: (e.target as HTMLInputElement).checked })} />
          </label>
          <div class="field">
            <label>Autosave every</label>
            <div class="seg">
              {AUTOSAVE_CHOICES.map((m) => (
                <button key={m} aria-pressed={prefs.autosaveMinutes === m} onClick={() => update({ autosaveMinutes: m })}>
                  {m === 0 ? 'Off' : `${m} min`}
                </button>
              ))}
            </div>
          </div>
          <button class="btn small" onClick={() => update({ tutorialSeen: false })}>Show the introduction again</button>
        </section>
        <p class="footnote">EPOCH stores worlds in this browser only. Use “Export” in the game menu to keep a copy elsewhere.</p>
      </div>
    </main>
  );
}
