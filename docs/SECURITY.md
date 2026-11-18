# Security and persistence review (round 2, 2026-11-18)

An independent auditor, run as a read-only subagent with no write access to `src/` or `tests/`, reviewed the save format, storage, import surface, UI rendering of save data, dependencies, network use and the world-generation worker. It reproduced each finding with scripts. Fixes were made by the lead and are covered by `tests/persistence/security.test.ts`, 29 tests. Run against the pre-fix decoder, 23 of its 28 decode and storage cases fail; the gzip-bomb case was left out of that comparison because the helper it uses does not exist in the old code.

**Threat model.** The only external input is a save file the player chooses to import, or a corrupted local save. No finding allowed script execution.

| ID | Severity | Finding | Fix | Status |
|---|---|---|---|---|
| V1 | Medium | Gzip decompression had no size limit. A 3 MB file inflated to 3 GiB, taking about 9 GB of RAM and 28 s, before the CRC check ran. | `gunzipCapped` streams the output and aborts above `MAX_SAVE_BYTES`, 256 MiB. The import UI also refuses files over 64 MiB. | Fixed and tested |
| V2 | Medium | Decoded saves were not validated. Crafted array tables, sizes or terrain values loaded "successfully" and then crashed the simulation. A crash inside the rAF loop froze the game silently and could be autosaved. | `decodeWorld` now validates table keys, types, offsets and lengths, computes `binStart` from the header, and checks map size (at most `MAX_MAP_SIDE`), exact array lengths, terrain ids, required state shape, entity ids, colours, statistics and territory snapshots. The game loop catches tick errors: it pauses, shows a message and stops autosaving. | Fixed and tested (22 hostile files) |
| V3 | Low | Malformed inputs threw raw TypeErrors and RangeErrors. | Every decode failure is now a `SaveError`. | Fixed and tested |
| V4 | Low–Med | Allocation sizes came straight from the file: `mapSize`, and territory snapshot `w×h`. | Both are bounded as part of V2. | Fixed and tested |
| V5 | Low–Med | Statistics padding was O(n²). An 80k-sample series froze the tab for about 15 s. | Padding is now a single pass, and loaded series are capped at 1000 samples. | Fixed and tested |
| V6 | Low | `SaveStore.save` was not atomic if a `put` threw synchronously. | `try { put; put } catch { tx.abort() }`. | Fixed and tested (simulated quota failure: the old save stays intact and no orphan data is written) |
| V7 | Low | `remove()` never settled if its transaction failed. | It now rejects on `error` and `abort`. | Fixed (code review only; not tested, because a failing delete is hard to trigger in fake-indexeddb) |
| V8 | Low | `open()` could hang on a blocked upgrade, which also disabled file import. | Added `onblocked`, an 8 s timeout and `onversionchange → close`. The app treats storage as ready in a `finally` block, so import keeps working. | Fixed (code review) |
| V9 | Low | An error in the main-thread handler for the world-generation worker left creation hanging forever. | The handler body is wrapped in try/catch, with `onmessageerror` and a user-visible error in `startWorld`. | Fixed (code review) |
| S1 | Low | A save could set a colour to `url(https://…)`, which the browser would fetch: a tracking beacon. | Colours must match `#rrggbb`, or the save is rejected. | Fixed and tested |
| S2 | Info | Saves with the same seed and name share a slot key. | — | Accepted (documented) |
| Dev server | Low/Info | `npm run dev` bound to all interfaces (`--host`), so the source tree was readable from the LAN. | `dev`/`preview` are now localhost only; `dev:lan`/`preview:lan` opt in. | Fixed |
| Fonts | Info | Google Fonts is loaded on every page view, sending the IP address to Google. | — | Accepted for now. Self-hosting the font is a listed follow-up. |
| Source maps | Info | `sourcemap: true` ships source maps to production. | — | Accepted (open-source project) |

## Dependencies (`npm audit`, 2026-11-18)

There are 7 advisories: 2 critical, 4 high and 1 moderate. They all come through tinypool (via vitest), @vitest/mocker and picomatch (via vite, vitest, fdir and tinyglobby).

**None ship in the browser bundle.** The only runtime dependency is preact 10.29.8, which has no advisories.

| Advisory | Exploitable here? |
|---|---|
| tinypool prototype pollution leading to RCE | No. It needs a pre-existing pollution primitive inside the trusted test process. |
| vitest mocker issues | No. They need vitest's browser or API server, which this project does not use. |
| picomatch ReDoS | No in practice. Glob patterns come from the project's own config, not from requests. |

Action: move to vitest 5.x in a dedicated dependency update. Do **not** apply npm's suggested `vite@6.2.7`, which is a downgrade.

## Checked and fine

- **Prototype pollution:** `__proto__` and `constructor` keys in JSON do not pollute globals; nothing in the load path merges objects.
- **Version handling:** the newer- and older-version paths and the V0 migration work. Migration is now tested.
- **Integrity checks:** CRC, truncation and garbage gzip are all rejected.
- **Failed imports:** a failed import never touches stored saves.
- **XSS:** `src/` has no `innerHTML`, `dangerouslySetInnerHTML`, `eval` or `new Function`. Names are rendered as escaped Preact text or drawn with canvas `fillText`. Every `<img src>` is a data URL generated locally.
- **Network:** `src/` makes no network calls.
