# Memory

## Project
| Name | What |
|------|------|
| **EPOCH** | "EPOCH: Civilizations Unbound": deterministic pixel-art civilization god sim (TypeScript, Vite, Preact, Canvas2D, Vitest, Playwright). Docs in `docs/` (STATUS, VALIDATION, ARCHITECTURE). |

- Work branch: `claude/epoch-civilizations-unbound-dap8pc`. Do not open a PR unless asked.
- Docs must be honest: no invented benchmarks or test runs, and emulation is not physical-device testing.

## Current plan
Round 7 is **done** (2026-11-19). It covered:
- concept effects for every power and event, and Reduce motion everywhere;
- render-cache freshness ("recall cache"): 9 stale cases fixed;
- WorldBox-style zone caching;
- jobs, streets, parks and traffic at real-world rates, home forms, highways, renovation.

Specs: `docs/superpowers/specs/2026-11-19-animations-design.md` and `2026-11-19-city-life-design.md`. Results are in `docs/VALIDATION.md` §R7. Known issues are ranked in `docs/STATUS.md`; the next candidate is capping workshop growth in modern cities. Round 6: `docs/VALIDATION.md` §R6, `docs/DESIGN-REVIEW.md`. Round 5 history: `docs/ROADMAP.md`.

## Standing to-dos
Do these **after all other work is finished**, as the last step of a round:

1. **Audit GitHub tests:** check the GitHub Actions runs (`ci.yml`, `long-run.yml`, `pages.yml`) for failures, flaky e2e, skipped jobs and stale workflow steps. Fix whatever is wrong and record the results in `docs/VALIDATION.md`.
2. **Audit for the newest packages:** run `npm outdated` and `npm audit`, then upgrade dependencies and dev-dependencies (including GitHub Actions versions, e.g. `actions/*@vN`) to their latest stable releases. One known item is the vitest 5 upgrade from SECURITY.md. Rerun the full gate after upgrading (`tsc`, `npm test`, build, e2e, viewports) and update SECURITY.md and STATUS.md.

## Preferences
- Ask questions where a decision is genuinely the user's to make.
- Use skills and plugins where they apply, and verify before claiming something is complete.
