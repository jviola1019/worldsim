/**
 * Pointer input for touch and mouse.
 *
 * Rules (designed so painting never fights with camera movement):
 *  - No tool / inspect tool: one finger (or left mouse) drags the camera; a
 *    tap selects; a long press (>= 500 ms, < 10 px movement) opens the inspector.
 *  - Brush tool: one finger paints; TWO fingers always pan & pinch-zoom. When a
 *    second finger lands mid-stroke, the stroke ends (and is undone if it was a
 *    brief accidental touch) and the gesture becomes a pinch.
 *  - Tap tool: a tap applies the power; dragging pans.
 *  - Mouse: wheel zooms at the cursor; right/middle button or Space+drag pans.
 */
import type { Camera } from '../rendering/camera';

export type Gesture = 'none' | 'pan' | 'pinch' | 'paint' | 'pending';

export interface InputCallbacks {
  toolKind: () => 'none' | 'brush' | 'tap';
  onTap: (sx: number, sy: number) => void;
  onLongPress: (sx: number, sy: number) => void;
  onPaint: (sx: number, sy: number, first: boolean) => void;
  onStrokeEnd: (cancelled: boolean) => void;
  onHover: (sx: number, sy: number, visible: boolean) => void;
  /** The camera moved: `panned` is true for a drag (a pinch or wheel only zooms). */
  onCamera: (panned: boolean) => void;
}

interface Ptr {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  t: number;
  button: number;
}

/** Pure classifier used by the handler and by tests. */
export function classify(pointerCount: number, tool: 'none' | 'brush' | 'tap', moved: boolean, spaceHeld = false, button = 0): Gesture {
  if (pointerCount >= 2) return 'pinch';
  if (pointerCount === 0) return 'none';
  if (button === 1 || button === 2 || spaceHeld) return 'pan';
  if (tool === 'brush') return 'paint';
  return moved ? 'pan' : 'pending';
}

export const LONG_PRESS_MS = 500;
export const TAP_SLOP = 10;

export class InputHandler {
  private ptrs = new Map<number, Ptr>();
  private gesture: Gesture = 'none';
  private strokeStart = 0;
  private longTimer: number | null = null;
  private pinchDist = 0;
  private pinchMid: [number, number] = [0, 0];
  private space = false;
  private detach: (() => void)[] = [];

  constructor(private el: HTMLElement, private cam: Camera, private cb: InputCallbacks) {
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(t, f as EventListener, opts);
      this.detach.push(() => el.removeEventListener(t, f as EventListener));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.up(e, true));
    on('pointerleave', () => this.cb.onHover(0, 0, false));
    on('wheel', (e) => this.wheel(e), { passive: false });
    on('contextmenu', (e) => e.preventDefault());
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.space = true;
      // round 9: keyboard zoom (+ / = in, - out) at the centre of the view, unless the player is typing
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser zoom and shortcuts stay the browser's
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === '+' || e.key === '=' || e.key === '-') {
        this.cam.zoomAt(this.cam.viewW / 2, this.cam.viewH / 2, e.key === '-' ? 1 / 1.25 : 1.25);
        this.cb.onCamera(false);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.space = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    this.detach.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku));
  }

  dispose(): void {
    for (const d of this.detach) d();
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private down(e: PointerEvent): void {
    this.el.setPointerCapture?.(e.pointerId);
    const [x, y] = this.local(e);
    this.ptrs.set(e.pointerId, { id: e.pointerId, x, y, sx: x, sy: y, t: performance.now(), button: e.button });
    const n = this.ptrs.size;
    if (n >= 2) {
      // a second finger: end any stroke, start pinching
      if (this.gesture === 'paint') this.cb.onStrokeEnd(performance.now() - this.strokeStart < 250);
      this.gesture = 'pinch';
      this.clearLong();
      this.startPinch();
      return;
    }
    const g = classify(1, this.cb.toolKind(), false, this.space, e.button);
    this.gesture = g;
    if (g === 'paint') {
      this.strokeStart = performance.now();
      this.cb.onPaint(x, y, true);
    }
    if (g === 'pending') {
      this.clearLong();
      this.longTimer = window.setTimeout(() => {
        const p = this.ptrs.get(e.pointerId);
        if (p && Math.hypot(p.x - p.sx, p.y - p.sy) < TAP_SLOP && this.gesture === 'pending') {
          this.gesture = 'none';
          this.cb.onLongPress(p.x, p.y);
        }
      }, LONG_PRESS_MS);
    }
  }

  private startPinch(): void {
    const [a, b] = [...this.ptrs.values()];
    this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    this.pinchMid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
  }

  private move(e: PointerEvent): void {
    const [x, y] = this.local(e);
    const p = this.ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.cb.onHover(x, y, true);
      return;
    }
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    if (this.gesture === 'pinch' && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      this.cam.pan(mid[0] - this.pinchMid[0], mid[1] - this.pinchMid[1]);
      this.cam.zoomAt(mid[0], mid[1], dist / this.pinchDist);
      this.pinchDist = dist;
      this.pinchMid = mid;
      this.cb.onCamera(false);
      return;
    }
    if (this.gesture === 'pending' && Math.hypot(p.x - p.sx, p.y - p.sy) >= TAP_SLOP) {
      this.gesture = 'pan';
      this.clearLong();
    }
    if (this.gesture === 'pan') {
      this.cam.pan(dx, dy);
      this.cb.onCamera(true);
    } else if (this.gesture === 'paint') {
      this.cb.onPaint(x, y, false);
      this.cb.onHover(x, y, true);
    }
  }

  private up(e: PointerEvent, cancelled = false): void {
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    this.clearLong();
    if (!p) return;
    if (this.gesture === 'paint') {
      this.cb.onStrokeEnd(cancelled);
      this.gesture = 'none';
    } else if (this.gesture === 'pending' && !cancelled) {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) < TAP_SLOP) this.cb.onTap(p.x, p.y);
      this.gesture = 'none';
    } else if (this.gesture === 'pinch') {
      // remaining finger continues as a pan, never as paint
      this.gesture = this.ptrs.size === 1 ? 'pan' : 'none';
      if (this.ptrs.size === 1) {
        const q = [...this.ptrs.values()][0];
        q.sx = q.x;
        q.sy = q.y;
      }
    } else if (this.ptrs.size === 0) this.gesture = 'none';
    if (e.pointerType !== 'mouse') this.cb.onHover(0, 0, false);
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const [x, y] = [e.offsetX, e.offsetY];
    this.cam.zoomAt(x, y, Math.exp(-e.deltaY * 0.0015));
    this.cb.onCamera(false);
  }

  private clearLong(): void {
    if (this.longTimer !== null) {
      clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }
}
