/**
 * Browser security policy for the static build (round 5, P7 security audit).
 *
 * The game is a static single-page app: no server, no accounts, no network calls. Everything
 * it loads (scripts, styles, the self-hosted Pixelify Sans font, the world-generation worker)
 * comes from its own origin, and every image it shows is drawn locally (data: or blob: URLs).
 * The policy below allows exactly that and nothing else.
 *
 * - `CSP_META` is injected as a <meta http-equiv> tag into the production build only
 *   (vite.config.ts); the dev server needs inline HMR scripts, so it is not applied there.
 * - `SECURITY_HEADERS` is written to `public/_headers` for hosts that honour that file
 *   (Netlify, Cloudflare Pages). GitHub Pages does not: there the meta CSP applies and the
 *   frame check in `framing.ts` stands in for `frame-ancestors`. See docs/SECURITY.md.
 */
export const CSP_DIRECTIVES: ReadonlyArray<readonly [string, string]> = [
  ['default-src', "'self'"],
  ['script-src', "'self'"],
  ['style-src', "'self'"],
  ['font-src', "'self' data:"],
  ['img-src', "'self' data: blob:"],
  ['connect-src', "'self'"],
  ['worker-src', "'self' blob:"],
  ['manifest-src', "'self'"],
  ['media-src', "'self' data: blob:"],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'none'"],
];

/** For the meta tag (browsers ignore frame-ancestors, report-uri and sandbox in meta CSP). */
export const CSP_META = CSP_DIRECTIVES.map(([k, v]) => `${k} ${v}`).join('; ');

/** For real HTTP headers: adds the directives that only work as headers. */
export const CSP_HEADER = `${CSP_META}; frame-ancestors 'self'; upgrade-insecure-requests`;

export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['Content-Security-Policy', CSP_HEADER],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Referrer-Policy', 'no-referrer'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
];

/** Text of `public/_headers` (Netlify / Cloudflare Pages format). Kept in sync by a test. */
export function headersFile(): string {
  return ['# Generated from src/security/policy.ts. GitHub Pages ignores this file; see docs/SECURITY.md.', '/*', ...SECURITY_HEADERS.map(([k, v]) => `  ${k}: ${v}`), ''].join('\n');
}
