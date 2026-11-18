/**
 * Clickjacking fallback. `frame-ancestors` cannot be set from a meta tag, and GitHub Pages
 * cannot send headers, so the app checks at start-up whether another site has framed it.
 * Same-origin framing (for example a docs page on the same host) is allowed.
 */
export interface FrameWindow {
  self: unknown;
  top: unknown;
  location: { origin: string };
}

export function framedCrossOrigin(win: FrameWindow): boolean {
  if (win.top == null || win.top === win.self) return false;
  try {
    return (win.top as FrameWindow).location.origin !== win.location.origin;
  } catch {
    return true; // reading a cross-origin parent's location throws
  }
}
