# Memory

## Project
| Name | What |
|------|------|
| **EPOCH** | "EPOCH: Civilizations Unbound": deterministic pixel-art civilization god sim (TypeScript, Vite, Preact, Canvas2D, Vitest, Playwright). Docs in `docs/` (STATUS, VALIDATION, ARCHITECTURE). |

- Work branch: `claude/epoch-civilizations-unbound-dap8pc`. Do not open a PR unless asked.
- Docs must be honest: no invented benchmarks or test runs, and emulation is not physical-device testing.

## Current plan
Round 10 (2026-11-20 to 24) covers:
- **Honest nation count** (`sim/peoples.ts`): bands are tribes; a nation needs a settlement.
- **Realistic grounded sandbox:** power sets in `powers/powerSet.ts`; empty start; Slow pace in `sim/pace.ts`.
- **Observer preset:** the old hands-off mode.
- **Medium-themed feed:** `ui/mediumTheme.ts`, with era fonts and one scroll.
- **Swipeable nation tabs.**
- **Accessibility audit:** `npm run a11y`, axe-core, also in CI.
- **Game-mode audit:** `scripts/mode-audit.ts`. Its fixes: developed starts in the right era, monsters slayable, explorers, sea routes, a diplomatic past, Islands era 3 and Space Race era 13.

Plan: `docs/superpowers/plans/2026-11-20-round10.md` (spec in `docs/superpowers/specs/`). Ledger: `.superpowers/sdd/2026-11-20-round10/progress.md` (git-ignored; read it first after a restart). Results: VALIDATION §R10 and DESIGN-REVIEW §R10.

Round 9 (done, 2026-11-19): device-labelled saves (`persistence/device.ts`), WorldBox-style close zoom (`rendering/closeup.ts`), follow camera and favourites, power urgency and clean-power bonus, elder-care jobs, and WebKit e2e (`BROWSER=webkit npm run e2e`; also in CI). Plan: `docs/superpowers/plans/2026-11-19-round9.md`. Results: `docs/VALIDATION.md` §R9; data in `docs/data/round9/`.

Round 8 (also done) covered:
- public-service jobs;
- city composition;
- the climate response and a finite feedback store;
- the round-6 leftovers;
- the code guide (`docs/GUIDE.md` and `/guide/`, facts from `tools/guide-facts.mjs`; run it after adding source files).

Plan: `docs/superpowers/plans/2026-11-19-round8.md`. Results: `docs/VALIDATION.md` §R8; compare balance runs with `tools/balance-compare.mjs`. Known issues are ranked in `docs/STATUS.md`. Earlier rounds: §R7 and §R6 in VALIDATION, and `docs/ROADMAP.md`.

## Standing to-dos
Do these **after all other work is finished**, as the last step of a round:

1. **Audit GitHub tests:** check the GitHub Actions runs (`ci.yml`, `long-run.yml`, `pages.yml`) for failures, flaky e2e, skipped jobs and stale workflow steps. Fix whatever is wrong and record the results in `docs/VALIDATION.md`.
2. **Audit for the newest packages:** run `npm outdated` and `npm audit`, then upgrade dependencies and dev-dependencies (including GitHub Actions versions, e.g. `actions/*@vN`) to their latest stable releases. One known item is the vitest 5 upgrade from SECURITY.md. Rerun the full gate after upgrading (`tsc`, `npm test`, build, e2e, viewports) and update SECURITY.md and STATUS.md.

## Preferences
- Ask questions where a decision is genuinely the user's to make.
- Use skills and plugins where they apply, and verify before claiming something is complete.
