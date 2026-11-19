# Security

Two audits so far:

- **Round 5 (2026-11-18), this page's main subject.** All 92 threats from the owner's list, checked against the real architecture. Each has a status, the affected files, a severity and evidence. Confirmed weaknesses were fixed with regression tests, and there is a threat model for a future backend.
- **Round 2 (2026-11-18).** The save format, storage and import surface. It is kept below as history; its 29 tests still run.

## 1. What the application actually is

| Aspect | Fact (verified in code and config) |
|---|---|
| Delivery | A static single-page app: one HTML file, JS and CSS bundles, a font, icons and one Web Worker. It is built by Vite and published to GitHub Pages by `.github/workflows/pages.yml`. |
| Server code | **None.** No backend, API, database, accounts, login, sessions, cookies, payments, uploads to a server, WebSockets, GraphQL, webhooks or email. |
| Network use at runtime | **None.** `src/` makes no `fetch`, XHR, WebSocket, EventSource or beacon calls (static guard test). Since this round, the font is self-hosted, so the page loads nothing from another origin. |
| Untrusted inputs | (1) A save file the player imports (`LoadScreen.tsx` → `importBytes` → `decodeWorld`). (2) `localStorage['epoch-prefs']` (`SettingsScreen.tsx`). (3) IndexedDB saves written by the app itself (`persistence/saves.ts`). (4) Text the player types: world name, seed, history search. |
| Rendering of data | Preact text nodes (escaped) and canvas `fillText`. No HTML sinks (static guard test). Images are generated locally as data: or blob: URLs. |
| Cross-context messaging | `postMessage` only between `ui/worldFactory.ts` and the same-origin module worker `workers/worldgen.worker.ts`. There is no `window` message listener. |
| "AI" in the game | Simulated fictional AI labs (`media/media.ts`). **No LLM, model API, agent, tool calls or MCP at runtime.** |
| Supply chain | One runtime dependency: `preact` 11.2.0. The fonts are `@fontsource/pixelify-sans` 5.3.0 and (round 6) `@fontsource/atkinson-hyperlegible` 5.3.0, both OFL-1.1 and bundled, so the CSP stays `'self'`. Dev tools: vite 8.3.8, vitest 5.1.1, TypeScript 7.0.2, tsx, fake-indexeddb, @types/node. CI is GitHub Actions. |
| Who can change what | Players can change only their own browser's state. No data is shared between players, so there is no tenant boundary. Repository write access and CI are the only privileged paths. |

**Threat model in one line:** the attacker controls a save file the victim imports, anything else on the same origin (an extension, the dev tools, another app on the same `github.io` subdomain), or a site that frames or links to the game. The attacker cannot reach a server, because there is none. The assets worth protecting are the player's saves, the integrity of the published build, and the repository and CI credentials.

## 2. Round 5 findings and fixes

| ID | Severity | Finding | Fix | Evidence |
|---|---|---|---|---|
| R5-1 | Low | **No Content-Security-Policy.** No XSS sink exists, but nothing limited the damage if one were added later or a dependency were compromised. | A strict CSP is injected as a `<meta>` tag into the production build only, through a Vite plugin (`vite.config.ts`, policy in `src/security/policy.ts`). It allows `script-src 'self'` and `style-src 'self'`, has no `unsafe-*` or wildcards, and sets `object-src 'none'`, `base-uri 'self'` and `form-action 'none'`. The dev server is unaffected. | Unit: `tests/security/hardening.test.ts` (no unsafe-*, wildcard or remote origins; plugin is build-only). **Dynamic (local build, Chromium):** e2e checks that the meta CSP is present and that there are no violations during a full play session. A script injected at runtime **is blocked** (`CSP blocks an injected inline script`) on phone and desktop. |
| R5-2 | Low | **No frame protection (clickjacking).** GitHub Pages cannot send `frame-ancestors` or `X-Frame-Options`, and a meta tag cannot carry them. | `src/security/framing.ts`: when another origin frames the page, the game does not start and instead offers "Open EPOCH in a new tab". Same-origin framing is still allowed. `public/_headers` adds `frame-ancestors 'self'` and `X-Frame-Options` for hosts that honour the file. | Unit: 2 tests (top level, same-origin frame, readable and opaque cross-origin parents). **Dynamic:** e2e frames the build from another origin and confirms the game refuses to run. |
| R5-3 | Info (privacy, supply chain) | **Third-party font.** Every visit sent the player's IP address to Google Fonts. It also needed CSP exceptions. | Pixelify Sans is self-hosted from `@fontsource/pixelify-sans` (OFL-1.1) and bundled by Vite. `index.html` has no external URL. | Unit: `index.html loads nothing from another origin`. e2e: `self-hosted Pixelify Sans loaded`. |
| R5-4 | Low | **Unvalidated preferences.** `loadPrefs` spread `JSON.parse(localStorage…)` into the settings. Any key or type survived, for example `autosaveMinutes: -1` or `"3"`, or extra keys. No prototype pollution was possible, because JSON.parse creates own properties. | `sanitizePrefs` keeps only the 5 known keys with the right types, and `autosaveMinutes` must be one of `[0, 1, 3, 10]`. Stored values over 4 KiB, malformed JSON and storage errors all fall back to the defaults. | 5 tests, including `__proto__` and `constructor` payloads and a hostile `localStorage` stub. |
| R5-5 | Low | **Loose decoding of new save fields.** The round-5 catastrophe log accepted any `type` (unbounded strings or objects), cure progress accepted any value, and the world name and seed had no type or length check. They are shown in the UI and used in file names. | `validateEndings` now requires string types of at most 40 characters, cure values in 0..1, at most 10,000 entries and a bounded `coolingSource`. The world name and seed must be strings of at most 200 characters. The seed field in the new-world form has `maxLength=64`. | 10 tests: one per malformed field, plus a well-formed control. |
| R5-6 | Low | **CI supply chain.** Actions were referenced by mutable tags (`@v4`). `actions/checkout` left the token in `.git/config`. The Pages workflow gave `pages: write` and `id-token: write` to the build job as well as the deploy job. | Every action is pinned to a full commit SHA, at its latest release (checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, configure-pages v6.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1). `persist-credentials: false` is set everywhere. Write permissions are granted only to the deploy job. CI runs Node 26 LTS. | 4 static tests over `.github/workflows/*.yml`: SHA pins, read-only default permissions, no `pull_request_target`, no `${{ github.event… }}` in steps, writes only in the Pages deploy job. |
| R5-7 | Info | **Dev-dependency advisories** carried over from round 2 (7 advisories via vitest 4 and vite 7). None shipped in the bundle. | Upgraded to vitest 5.1.1, vite 8.3.8, TypeScript 7.0.2, preact 11.2.0 and @types/node 26.6.6. | `npm audit`: **0 vulnerabilities** (2026-11-18). Full gate rerun on the new toolchain (§4). |

Nothing found allowed script execution, data theft, or any effect on another player.

## 3. Threat matrix (all 92)

**Status key**

- **N/A:** the component the threat needs does not exist in this architecture. The reason is given.
- **Verified Secure:** the threat applies and the control was checked, with the evidence named.
- **Vulnerable → fixed:** a weakness was confirmed this round and fixed, with a regression test.
- **Not Yet Tested:** applicable, but needs manual or production-side verification (§5).

**Severity** rates what is actually exposed here: None, Info, Low, Medium, High or Critical. For N/A rows the severity is "None (today)", and the future-backend model (§6) gives the controls the threat would need.

### Original 20

| # | Threat | Status | Where / why | Sev. | Evidence |
|---|---|---|---|---|---|
| 1 | HTTP/2 Rapid Reset | N/A | No server is operated; GitHub Pages (GitHub's CDN) terminates HTTP/2. | None | Architecture §1 |
| 2 | 52-character username (bcrypt 72-byte truncation) | N/A | No usernames or passwords. | None | §1 |
| 3 | SAML bypass | N/A | No SSO. | None | §1 |
| 4 | nOAuth email spoof | N/A | No OAuth or identity provider. | None | §1 |
| 5 | GraphQL aliases | N/A | No GraphQL. | None | §1 |
| 6 | 2FA code replay | N/A | No authentication. | None | §1 |
| 7 | ReDoS regex | Verified Secure | Every regex in `src/` is a fixed, linear pattern (`HEX`, `/^know\.\d+$/`, file-name sanitizers `[^\w-]+`). History search uses `includes`, not a regex built from input. No `new RegExp` in `src/`. | None | Code review (grep `new RegExp\|\.test(\|\.match(`) |
| 8 | JWT algorithm confusion | N/A | No JWTs. | None | §1 |
| 9 | Request smuggling | N/A | No server or proxy chain of ours. | None | §1 |
| 10 | Cache poisoning | N/A | Static immutable assets with content-hashed names; no service worker; no per-user responses. | None | `dist/assets/*-[hash].*` |
| 11 | Spoofed IP header | N/A | No server logic reads headers. | None | §1 |
| 12 | Views bypass RLS | N/A | No database. | None | §1 |
| 13 | Math.random tokens | Verified Secure | `Math.random` is used only for a toast id, audio noise, a suggested seed name and the "randomize settings" button. None of these is a security token, and the simulation uses its own seeded RNG. A static guard confines `Math.random` to those 3 files. | None | `hardening.test.ts` › Math.random is confined… |
| 14 | Timing attack | N/A | No secret comparisons. | None | §1 |
| 15 | Padding oracle | N/A | No encryption or decryption of attacker data. The save CRC is an integrity check, not a MAC. | None | §1 |
| 16 | Prototype pollution | Verified Secure | The save decoder never merges parsed objects into existing ones. Prefs now go through a whitelist (R5-4). JSON.parse creates own `__proto__` properties only. | None | `security.test.ts` (round 2); `hardening.test.ts` › __proto__ key… |
| 17 | Template injection | N/A | No server-side templates. Preact JSX escapes text. | None | §1 |
| 18 | XXE file read | N/A | No XML parsing. | None | §1 |
| 19 | WebSocket hijack | N/A | No WebSockets (static guard). | None | `hardening.test.ts` › no network calls |
| 20 | Unicode case-mapping collisions ("SPOTIFY") | N/A | No account names or unique identifiers typed by users. Save slot keys use name + seed and only overwrite the player's own saves (S2, accepted). | None | §1 |

### Authentication, authorization and database (21–42)

| # | Threat | Status | Where / why | Sev. | Evidence |
|---|---|---|---|---|---|
| 21 | Broken access control / IDOR | N/A | No server objects. Saves live in the player's own browser storage, isolated by the browser's same-origin policy. | None | §1 |
| 22 | BOLA | N/A | No API. | None | §1 |
| 23 | BFLA | N/A | No API. In-game, "god powers" are not a security boundary: observer mode is a game rule, and the player owns the world. It is still enforced and tested (horrors and decrees are refused in observer worlds). | None | `endings.test.ts`, `ethos.test.ts` (observer refusals) |
| 24 | BOPLA | N/A | No API. | None | §1 |
| 25 | Horizontal or vertical privilege escalation | N/A | Single local user. | None | §1 |
| 26 | Cross-tenant data leakage | N/A | No tenants. A save file contains only simulation state: no personal data, file paths or device identifiers. | None | Code review of `encodeWorld` |
| 27 | Insecure RLS policies | N/A | No database. | None | §1 |
| 28 | SECURITY DEFINER misuse | N/A | No database. | None | §1 |
| 29 | SQL injection | N/A | No SQL. | None | §1 |
| 30 | NoSQL injection | N/A | IndexedDB is accessed by fixed store names and keys generated by the app. No query language. | None | `persistence/saves.ts` |
| 31 | Mass assignment / overposting | Vulnerable → fixed (Low) | The local equivalent: unknown keys from storage flowed into settings objects. Prefs are now whitelisted (R5-4). Save state is validated field by field (V2, R5-5). | Low | `hardening.test.ts` › keeps only known keys |
| 32 | Auth and password reset bypass | N/A | No auth. | None | §1 |
| 33 | Brute force / credential stuffing | N/A | No credentials. | None | §1 |
| 34 | Account enumeration | N/A | No accounts. | None | §1 |
| 35 | Session fixation or hijacking | N/A | No sessions. | None | §1 |
| 36 | Insecure cookies or browser token storage | Verified Secure | No cookies, tokens or secrets are stored. `localStorage` holds 5 cosmetic preferences (now validated). IndexedDB holds the player's own saves. | None | Code review; `hardening.test.ts` |
| 37 | Refresh-token replay | N/A | No tokens. | None | §1 |
| 38 | OAuth/OIDC state, nonce, PKCE, redirects | N/A | No OAuth. | None | §1 |
| 39 | JWT signature, issuer, audience, expiry | N/A | No JWTs. | None | §1 |
| 40 | Weak password storage | N/A | No passwords. | None | §1 |
| 41 | Email verification or account-linking bypass | N/A | No email or accounts. | None | §1 |
| 42 | Stale permissions after role change | N/A | No roles. On the repository side, collaborator access is managed by the owner (§5). | None | §1 |

### APIs, frontend and backend (43–64)

| # | Threat | Status | Where / why | Sev. | Evidence |
|---|---|---|---|---|---|
| 43 | XSS (stored, reflected, DOM) | Verified Secure, now with defense in depth | Stored XSS would have to come through a save file. Names and events from saves are rendered as escaped Preact text or canvas text. There are no HTML sinks and no URL or route parameters. The CSP now also blocks injected scripts (R5-1). | None | Static guard `no HTML sinks…`; e2e `CSP blocks an injected inline script` |
| 44 | CSRF | N/A | No state-changing server endpoints or cookies. | None | §1 |
| 45 | SSRF | N/A | No server-side fetching; the client makes no requests either. | None | Static guard `no network calls` |
| 46 | OS command injection | N/A at runtime | Build scripts (`tools/`, `scripts/`) run only on developer and CI machines with fixed arguments. | None | Code review |
| 47 | Path traversal / file inclusion | N/A | No server file access. Download file names are sanitized (`[^\w-]+ → _`), and the browser controls the save location. | None | `MenuPanel.tsx:35`, `CivPhotos.tsx:16` |
| 48 | Insecure file uploads | Verified Secure | The import is processed locally. It is limited to 64 MiB before reading, gunzip output is capped at 256 MiB, and the file must pass a CRC and the full structural validation. | Low | `security.test.ts` (22 hostile files, gzip bomb) |
| 49 | Unsafe deserialization | Verified Secure (one gap fixed) | The custom binary and JSON format is not a code-executing deserializer. Every field is validated, bounded and typed. The new round-5 fields had loose bounds and were tightened (R5-5). | Low | `security.test.ts`; `hardening.test.ts` (10 new cases) |
| 50 | CORS misconfiguration | N/A | No API. GitHub Pages serves static files. | None | §1 |
| 51 | Clickjacking | Vulnerable → fixed (Low) | No frame protection existed. The cross-origin frame fallback is now in the app, and headers are in `_headers` for hosts that honour them (R5-2). | Low | Unit + e2e `refuses to run inside a cross-origin frame` |
| 52 | Open redirect | N/A | No redirects or URL parameters. The only `location` use is the framing notice, which links to the game's own URL. | None | `main.tsx` |
| 53 | Missing or ineffective CSP | Vulnerable → fixed (Low) | Strict meta CSP added and tested dynamically (R5-1). `frame-ancestors` and `upgrade-insecure-requests` work only as headers (`_headers`). | Low | e2e `production CSP is in force`, `no CSP violations` |
| 54 | postMessage origin verification | Verified Secure | Messages travel only between the page and its own dedicated worker, which other origins cannot reach. There is no `window` message listener (static guard). | None | `hardening.test.ts` › no window message listener |
| 55 | Untrusted HTML, Markdown or rich text | Verified Secure | Nothing renders HTML or Markdown. The feed, newspaper and social posts are plain text built from state. | None | Static guard `no HTML sinks…` |
| 56 | Rate-limit bypass / resource consumption | Verified Secure (client) | A hostile save cannot force huge allocations: map side ≤ 1024, statistics ≤ 1000 samples, territory ≤ 200 snapshots, album ≤ 5000, catastrophe log ≤ 1000, file ≤ 64 MiB, inflated size ≤ 256 MiB. | Low | `security.test.ts` V1–V5; `hardening.test.ts` |
| 57 | GraphQL depth / batching | N/A | No GraphQL. | None | §1 |
| 58 | WebSocket subscriptions | N/A | No WebSockets. | None | §1 |
| 59 | Webhook signatures / replay | N/A | No webhooks. | None | §1 |
| 60 | Race conditions / TOCTOU | Verified Secure (local) | Save writes are atomic: one IndexedDB transaction, aborted on a synchronous throw (V6). The simulation is single-threaded and deterministic. | Low | `security.test.ts` (quota failure leaves the old save intact) |
| 61 | Business-logic abuse | N/A (single-player) | Players may do anything to their own world; there is nothing to gain at anyone else's expense. Observer-mode rules are enforced as a game feature. | None | Observer tests |
| 62 | Payment or entitlement manipulation | N/A | No payments or entitlements. | None | §1 |
| 63 | Missing idempotency | N/A | No financial or server-side state changes. Repeating a save overwrites the same slot. | None | §1 |
| 64 | Sensitive data in shared caches | N/A | No user data on any server or CDN. Saves never leave the device unless the player exports a file. | None | §1 |

### Infrastructure, cloud and supply chain (65–80)

| # | Threat | Status | Where / why | Sev. | Evidence |
|---|---|---|---|---|---|
| 65 | Secrets in frontend bundles | Verified Secure | The app has no secrets, keys or env-injected credentials. `import.meta.env` is not used for secrets. | None | Static secret-pattern guard over `src/`; history scan (§4) |
| 66 | Credentials in Git or build artifacts | Verified Secure | A regex scan of all 78 commits found no AWS, GitHub, Slack, Google or OpenAI/Anthropic-style keys, private keys or `password=`/`token=` literals, and no `.env`, `.pem`, `.npmrc` or credential files are tracked. GitHub's secret scanner could not be run: Advanced Security is not enabled on the repo (§5). | None | §4 |
| 67 | Public tables, buckets or cloud resources | N/A | None exist. The Pages site is meant to be public. | None | §1 |
| 68 | Exposed dev, debug or admin endpoints | Verified Secure | No admin endpoints. The dev and preview servers bind to localhost by default (`dev:lan` is opt-in, round 2). Source maps are published deliberately (open-source project). | Info | `package.json` scripts |
| 69 | Insecure pre-signed URLs | N/A | No object storage. | None | §1 |
| 70 | Encryption, TLS and key management | Not Yet Tested (host) | GitHub Pages provides TLS for `*.github.io`. The owner should confirm "Enforce HTTPS" is on (§5). No keys are managed by the app. | Low | Manual |
| 71 | Missing HSTS and security headers | Partly mitigated; Not Yet Tested on host | GitHub Pages does not allow custom headers. Covered in-app: CSP (meta) and the frame fallback. Header file for other hosts: `public/_headers` (HSTS, CSP + `frame-ancestors`, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP). Verified 2026-11-19 on the live site: GitHub sends `strict-transport-security: max-age=31556952` for github.io and redirects `http://` to `https://` (301). The site itself cannot configure this header. | Low | `hardening.test.ts` › `_headers` matches policy |
| 72 | Vulnerable or malicious dependencies | Verified Secure | `npm audit`: 0 vulnerabilities after the upgrade (R5-7). One runtime dependency (preact), plus the bundled font. Exact versions are pinned in `package.json`, and `package-lock.json` holds integrity hashes. | None | §4 |
| 73 | Dependency confusion / typosquatting | Verified Secure | All packages are public, well-known npm packages with no private scopes. The names were checked by hand: `preact`, `@fontsource/pixelify-sans`, `vite`, `vitest`, `typescript`, `tsx`, `fake-indexeddb`, `@types/node`. CI uses `npm ci` with the lockfile. | None | Review of `package.json` and `package-lock.json` |
| 74 | Compromised build pipelines / CI credentials | Vulnerable → fixed (Low) | Mutable action tags, a persisted checkout token and over-broad Pages permissions were fixed (R5-6). No repository secrets are used by any workflow. | Low | 4 static CI tests |
| 75 | Insecure deployment previews / env config | Verified Secure | No preview deployments. Pages deploys through the `github-pages` environment from pushes to `main` **and** to the work branch `claude/epoch-civilizations-unbound-dap8pc` (`pages.yml`; every live deploy so far came from the work branch). No environment variables carry secrets. | None | `pages.yml` |
| 76 | Subdomain takeover / DNS | Not Yet Tested (owner) | No custom domain is configured; the site uses `<owner>.github.io`. If a custom domain is added, verify the domain in GitHub to prevent takeover (§5). | Info | Manual |
| 77 | Email-domain spoofing (SPF, DKIM, DMARC) | N/A | The app sends no email and owns no domain. | None | §1 |
| 78 | Logs, backups and exports | N/A | No server logs or backups. Exported saves are files the player chooses to create. CI artifacts (long-run results) hold only simulation statistics. | None | `long-run.yml` |
| 79 | Audit logging and monitoring | N/A (no server) | Nothing server-side to monitor. Repository events are covered by GitHub's own audit log. In-game errors are shown to the player and stop autosave (V2). | Info | §1 |
| 80 | DoS through oversized uploads or bombs | Verified Secure | Gzip bombs, oversized files and allocation bombs are all capped (see 48 and 56). | Low | `security.test.ts` V1, V4, V5 |

### AI-generated application and AI agents (81–92)

| # | Threat | Status | Where / why | Sev. | Evidence |
|---|---|---|---|---|---|
| 81 | Direct or indirect prompt injection | N/A at runtime | The game uses no LLM; in-game "AI" is a deterministic simulation. | None | §1 |
| 82 | Agent tool-call injection | N/A at runtime | No agents or tools in the product. | None | §1 |
| 83 | Disclosure through model output or retrieved context | N/A at runtime | No model. | None | §1 |
| 84 | System prompt leakage | N/A at runtime | No prompts. Development instructions (`CLAUDE.md`) are public, contain no secrets, and are meant to be read. | None | `CLAUDE.md` |
| 85 | RAG or vector DB poisoning | N/A | None. | None | §1 |
| 86 | Excessive agent permissions | Applicable to development: controlled | The code was written with an AI coding agent. It works only on the dedicated branch, opens no PRs unless asked, and pushes only to that branch. GitHub access is limited to this repository. CI runs read-only. | Low | Process (`CLAUDE.md`, branch rules) |
| 87 | Unsafe handling of AI-generated HTML, SQL, shell or code | Verified Secure (product) | The product never executes generated content: no eval, no HTML sinks, no SQL, no shell. | None | Static guards |
| 88 | Malicious or untrusted MCP servers | N/A at runtime | The product uses no MCP. During development the agent used GitHub's MCP tools scoped to this repository; no third-party MCP output is executed by the product. | None | §1 |
| 89 | AI-generated dependency, config or security-design flaws | Applicable to development: reviewed | Every dependency added in this round (`@fontsource/pixelify-sans`) was checked for name, licence and maintainer. Configs (CSP, workflows) are covered by regression tests. This audit is itself the security-design review. | Low | This document; `hardening.test.ts` |
| 90 | AI endpoint abuse / cost exhaustion | N/A | No AI endpoint. | None | §1 |
| 91 | Sandboxing of AI-executed code | N/A at runtime | No AI-executed code in the product. The development agent ran in an isolated, ephemeral cloud container. | None | §1 |
| 92 | AI-generated code deployed without security regression tests | Applicable: controlled | Every push runs typecheck, all unit tests (including 61 security tests: 32 in `tests/security/`, 29 in `tests/persistence/security.test.ts`), the build and the browser e2e suite (including the CSP and framing checks). Pages deploys from `main` or the work branch after `npm test` and the build pass in `pages.yml`. It is **not** gated on the CI workflow, so typecheck and e2e failures do not block a deploy: a docs-only commit went live while CI run #42 was red on a flaky e2e check, since fixed. | Low | `ci.yml`, `pages.yml` |

**Totals:** 64 not applicable to this architecture, 17 verified secure (two of them with tightened bounds: rows 31 and 49 overlap R5-4 and R5-5), 4 confirmed vulnerabilities fixed with tests (rows 51, 53, 74, plus 31; R5-3 and R5-7 were hardening outside the numbered list), 3 needing owner or host verification (rows 70, 71, 76) and 4 development-process items under control (86, 89, 92; 23 is a game rule). Some rows are counted in two groups.

## 4. Verification performed (2026-11-18)

All testing was local and non-production: the local build (`vite preview` on localhost) in headless Chromium. Nothing was run against GitHub Pages or any third-party system. Round 7 (2026-11-19): the read-only e2e suite was also run against the live site (`URL=https://jviola1019.github.io/worldsim/ node tests/e2e/run-e2e.mjs`), with 61/61 passing, including the CSP, injected-script, framing and IndexedDB checks. The live bundle was byte-identical to a local build of the deployed commit.

| Check | Command or method | Result |
|---|---|---|
| Dependency audit | `npm audit` | 0 vulnerabilities |
| Outdated packages | `npm outdated` | All direct dependencies on their latest versions |
| Static analysis | `tsc --noEmit` (TypeScript 7.0.2, strict) and the source-tree guards in `tests/security/hardening.test.ts` (HTML sinks, eval, network calls, message listeners, `Math.random`, secret patterns, `noopener`) | Clean; guards pass |
| Secret scanning | Regex scan of `git log --all -p` (78 commits) for common key formats, private keys and credential literals; tracked-file check for `.env`, `.pem`, `.npmrc` and credential files | No findings. The GitHub secret-scanning API was not available (Advanced Security not enabled). gitleaks was not run: downloading and executing a binary was not permitted in this environment. |
| Security unit tests | `npx vitest run tests/security tests/persistence` | 66/66 |
| Dynamic checks | `npm run e2e` against the production build: CSP present, no CSP violations in a full session, injected inline script blocked, cross-origin frame refused, self-hosted font loaded, no console errors (phone emulation and desktop) | 28/28 |
| Full regression | `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` | See STATUS.md for this round's counts |
| Mutation checks | Each new fix was reverted one at a time and its test was confirmed to fail | Recorded in VALIDATION.md |
| Auth, roles and tenant isolation | — | Not applicable: no users, roles or tenants exist (§1) |

## 5. Unresolved risks and settings the owner must verify by hand

1. **GitHub Pages headers.** Pages cannot send custom headers: CSP `frame-ancestors`, nosniff, Referrer-Policy or Permissions-Policy headers. The meta CSP and frame fallback cover the main cases. For full header control, host the `dist/` folder on Cloudflare Pages or Netlify (`_headers` is already in the build), or put a CDN in front of Pages.
2. **Enforce HTTPS:** check Settings → Pages → "Enforce HTTPS" after the first deploy.
3. **HSTS preload:** confirm that `github.io` is on the HSTS preload list for current browsers (hstspreload.org). If a custom domain is added, configure HSTS on the CDN and verify the domain (Settings → Pages → verified domains) to prevent subdomain takeover.
4. **Repository settings:**
   - Protect `main` (require the CI check, no force-push).
   - Keep the `github-pages` environment limited to `main` once work moves there. Today `pages.yml` also deploys the work branch; that is the owner's choice.
   - Enable Dependabot alerts.
   - Enable secret scanning and push protection (free for public repositories).
   - Optionally add Dependabot version updates for `npm` and `github-actions`. This was not added automatically, because it opens pull requests.
5. **Same-site neighbours on github.io.** Pages sites under the same `<owner>.github.io` share an origin when served as project paths, so they share `localStorage` and IndexedDB. Only the owner's own projects live there. The prefs whitelist and the save validation limit what a hostile neighbour could do (§2 R5-4, R5-5).
6. **Source maps** are published (accepted: open source).
7. **Physical devices.** The CSP and framing were verified in Chromium (desktop and iPhone 13 emulation) only. Safari and Firefox on real devices have not been tested; emulation is not physical-device testing.

## 6. Threat model for a future backend

There is no backend today. If one is added (cloud saves, accounts, leaderboards, shared worlds or an LLM feature), these controls are **required before launch**, mapped to the numbered threats. Each needs a test in CI.

| Feature | Threats that become live | Required controls | Tests to add |
|---|---|---|---|
| Accounts and login | 2–4, 6, 8, 32–42 | Use a managed OIDC provider with the authorization-code flow plus PKCE, and check state and nonce. Allow-list exact redirect URIs. Never use email as the identity key; use the provider's immutable `sub` (nOAuth). Keep server sessions in `HttpOnly; Secure; SameSite=Lax` cookies, rotated on login, with no tokens in `localStorage`. Rotate refresh tokens with reuse detection. Verify every JWT's signature with a pinned algorithm, plus `iss`, `aud`, `exp` and `nbf`. Hash passwords with Argon2id (if passwords exist at all). Return the same response and timing for unknown and known accounts. Use single-use, time-limited, rate-limited 2FA codes. Revoke sessions when a user is deactivated or their role changes. | Auth flow tests per role; replay, expired, wrong-audience and `alg:none` token tests; enumeration timing test |
| Cloud saves | 21–27, 31, 48, 49, 56, 60, 63, 64, 67, 69, 80 | Reuse `decodeWorld` validation on the server unchanged, plus size quotas. Do object-level authorization on every request (the owner id comes from the session, never from the body). Either enable RLS on every table, with `FORCE ROW LEVEL SECURITY`, no `SECURITY DEFINER` functions without a fixed `search_path` and ownership checks, and views created `security_invoker`, or use a storage service with per-user prefixes. Use parameterized queries only. Accept explicit field allow-lists (no mass assignment). Use idempotency keys on writes. Send `Cache-Control: private, no-store` for user data. Keep buckets private, with short-lived pre-signed URLs scoped to one object and method. | Cross-user IDOR tests (user A cannot read, list or overwrite B's saves); RLS tests that run as each role, including through views; oversize and bomb uploads; concurrent-write test |
| Leaderboards or shared worlds | 11, 56, 57, 58, 61 | Validate scores on the server, for example by replaying the deterministic simulation from the seed and inputs rather than trusting client numbers. Rate-limit per account and per IP, with the IP taken only from the trusted proxy header. Authorize every WebSocket subscription and message, and check the `Origin` header. If GraphQL is used, set depth and complexity limits and disable or cap aliases and batching. | Score-tampering test, rate-limit test, unauthorized-subscription test |
| Payments (if ever) | 59, 62, 63 | Use a hosted checkout. Grant entitlements only from verified webhooks: HMAC signature, timestamp tolerance and a replay cache. Use idempotency keys. Never trust prices sent by the client. | Forged and replayed webhook tests; duplicate-event test |
| Any server | 1, 9, 10, 17, 18, 29, 30, 44–47, 50, 52, 65–71, 74–79 | Use a managed edge with HTTP/2 rapid-reset mitigations. Avoid server-side templates over user data and XML parsers (or disable external entities). Set CORS to an allow-list of exact origins, without credentials for `*`. Use CSRF tokens or SameSite cookies on state changes. Never interpolate shell commands. Allow-list SSRF egress destinations. Keep secrets in a secrets manager, never in the bundle. Require TLS 1.2 or later with HSTS. Send structured audit logs to a store with restricted access, with alerts on authentication anomalies. Restrict and encrypt backups. Publish SPF, DKIM and `p=reject` DMARC on any sending domain. | Header tests on deployed preview, a DAST scan of the preview (authorized), and CORS and CSRF negative tests |
| LLM features (for example narrated history) | 81–92 | Treat model output as untrusted text and render it with the existing escaped path, never as HTML. Give the model no tools, or a read-only allow-list with server-side authorization of every call. Keep secrets and other users' data out of the context. Never execute model output. Set per-user token and cost quotas and rate limits. Use only first-party, pinned MCP servers. Add red-team prompt-injection tests in CI. | Injection corpus tests, output-escaping tests, quota tests |

---

# Round 2 audit: save format and storage (2026-11-18)

An independent auditor reviewed the save format, storage, import surface, UI rendering of save data, dependencies, network use and the world-generation worker. The auditor ran as a read-only subagent with no write access to `src/` or `tests/`, and reproduced each finding with scripts. The lead made the fixes, which are covered by `tests/persistence/security.test.ts` (29 tests). Run against the pre-fix decoder, 23 of its 28 decode and storage cases fail. The gzip-bomb case was left out of that comparison, because the helper it uses does not exist in the old code.

**Threat model at the time.** The only external input is a save file the player chooses to import, or a corrupted local save. No finding allowed script execution.

| ID | Severity | Finding | Fix | Status |
|---|---|---|---|---|
| V1 | Medium | Gzip decompression had no size limit. A 3 MB file inflated to 3 GiB, taking about 9 GB of RAM and 28 s, before the CRC check ran. | `gunzipCapped` streams the output and aborts above `MAX_SAVE_BYTES` (256 MiB). The import UI also refuses files over 64 MiB. | Fixed and tested |
| V2 | Medium | Decoded saves were not validated. Crafted array tables, sizes or terrain values loaded "successfully" and then crashed the simulation. A crash inside the rAF loop froze the game silently and could be autosaved. | `decodeWorld` validates table keys, types, offsets and lengths; map size; exact array lengths; terrain ids; state shape; entity ids; colours; statistics; and territory snapshots. The game loop catches tick errors: it pauses, shows a message and stops autosaving. | Fixed and tested (22 hostile files) |
| V3 | Low | Malformed inputs threw raw TypeErrors and RangeErrors. | Every decode failure is now a `SaveError`. | Fixed and tested |
| V4 | Low–Med | Allocation sizes came straight from the file: `mapSize`, and territory snapshot `w×h`. | Both are bounded as part of V2. | Fixed and tested |
| V5 | Low–Med | Statistics padding was O(n²). An 80k-sample series froze the tab for about 15 s. | Padding is now a single pass, and loaded series are capped at 1000 samples. | Fixed and tested |
| V6 | Low | `SaveStore.save` was not atomic if a `put` threw synchronously. | `try { put; put } catch { tx.abort() }`. | Fixed and tested |
| V7 | Low | `remove()` never settled if its transaction failed. | It rejects on `error` and `abort`. | Fixed (code review) |
| V8 | Low | `open()` could hang on a blocked upgrade. | Added `onblocked`, an 8 s timeout and `onversionchange → close`. | Fixed (code review) |
| V9 | Low | An error in the worker message handler left world creation hanging. | try/catch, `onmessageerror` and a user-visible error. | Fixed (code review) |
| S1 | Low | A save could set a colour to `url(https://…)`, which the browser would fetch: a tracking beacon. | Colours must match `#rrggbb`, or the save is rejected. | Fixed and tested |
| S2 | Info | Saves with the same seed and name share a slot key. | — | Accepted |
| Dev server | Low/Info | `npm run dev` bound to all interfaces. | Localhost by default; `dev:lan` opts in. | Fixed |
| Fonts | Info | Google Fonts was loaded on every page view. | Self-hosted in round 5 (R5-3). | Fixed |
| Source maps | Info | Shipped to production. | — | Accepted (open source) |
