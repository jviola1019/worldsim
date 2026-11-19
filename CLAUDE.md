# Memory

## Project
| Name | What |
|------|------|
| **EPOCH** | "EPOCH: Civilizations Unbound": deterministic pixel-art civilization god sim (TypeScript, Vite, Preact, Canvas2D, Vitest, Playwright). Docs in `docs/` (STATUS, VALIDATION, ARCHITECTURE). |

- Work branch: `claude/epoch-civilizations-unbound-dap8pc`. Do not open a PR unless asked.
- Docs must be honest: no invented benchmarks or test runs, and emulation is not physical-device testing.

## Current plan
Round 6 (city detail, planning rule, full design review): spec `docs/superpowers/specs/2026-11-18-city-detail-design.md` (approved), plan `docs/superpowers/plans/2026-11-18-city-detail.md`, progress ledger `.superpowers/sdd/2026-11-18-city-detail/progress.md` (git-ignored; if lost, use `git log`). Round 5 history: `docs/ROADMAP.md`. Read the ledger first after any restart.

## Standing to-dos
Do these **after all other work is finished**, as the last step of a round:

1. **Audit GitHub tests:** check the GitHub Actions runs (`ci.yml`, `long-run.yml`, `pages.yml`) for failures, flaky e2e, skipped jobs and stale workflow steps. Fix whatever is wrong and record the results in `docs/VALIDATION.md`.
2. **Audit for the newest packages:** run `npm outdated` and `npm audit`, then upgrade dependencies and dev-dependencies (including GitHub Actions versions, e.g. `actions/*@vN`) to their latest stable releases. One known item is the vitest 5 upgrade from SECURITY.md. Rerun the full gate after upgrading (`tsc`, `npm test`, build, e2e, viewports) and update SECURITY.md and STATUS.md.

## Preferences
- Ask questions where a decision is genuinely the user's to make.
- Use skills and plugins where they apply, and verify before claiming something is complete.
