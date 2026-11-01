# Execution plan: BOOT-010 Sheet layouts, optimizer, consumables and costs (M2 package 3)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Merged, go ahead with package 3". This covers sheet layouts, the optimizer, consumables and costs (see `docs/roadmap.md`, `docs/cabinet-rules.md` → Sheet layouts and Materials, counts and cost). Work record BOOT-010. |
| Branch | `agent/claude/m2-sheets-costs` |
| Pull request | #10 (draft) |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | In progress |

## Goal and done-when

`src/cabinets/` gains the prototype's:

- quick sheet layout (`nest`)
- on-demand optimizer (`workerMain`), as a pure function
- result acceptance and signature
- readable cut steps (`cutPlanHtml`, as data)
- consumables
- sheet counts with spares
- every material line's count, packs, subtotal, tax and total

This is done when:

- Golden tests match fixtures recorded from the unchanged prototype for the starter kitchen and synthetic cases:
  - quick sheets
  - optimizer sheets for a fixed number of tries
  - cut step text
  - consumables
  - the money shown on the page
- Typecheck, tests and build pass. The docs and review queue are updated.

**Out of scope:**

- wall layout, toe kick strips, countertop and platform runs (package 4). Consumables take the platform run lengths and placed-panel count as inputs.
- running the optimizer in a Web Worker and any UI (package 7)

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR (#10)
2. [x] Extend `scripts/prototype-fixtures.mjs` to write `tests/fixtures/prototype-sheets.json`. It records:
   - the starter kitchen's full computation (groups including toe kick, quick sheets, consumables, counts, and the money on the page)
   - synthetic nest cases (rotation, a part too big)
   - optimizer runs with a negative time budget, which gives exactly the 40 fixed tries plus 1 random one and is repeatable
   - cut step text for each sheet
3. [x] `src/cabinets/sheets.ts`: material info, quick layout, warnings for parts that don't fit, plus a golden test
4. [x] `src/cabinets/optimizer.ts`: both packers, the scoring, the fixed-seed tries, the time or try budget, the signature, the acceptance rule and the area lower bound, plus a golden test
5. [x] `src/cabinets/cutsteps.ts`: strips, crosscuts, rips and leftovers as data, plus a golden test against the prototype's text
6. [x] `src/cabinets/costs.ts`: consumables, plywood sheets with spares, material counts, cost lines with tax, and money formatting, plus a golden test against the page's numbers
7. [~] Docs (architecture, cabinet rules status, review queue R-018, work record, roadmap), checks, PR description, mark ready

## Next action

Step 7:

- `docs/architecture.md`: extend the cabinet engine section with sheets, the optimizer, cut steps and costs.
- `docs/cabinet-rules.md` status.
- `docs/review-queue.md`: add R-018.
- `docs/work-record.md`: add BOOT-010.
- `docs/roadmap.md`: package 3 in review.
- Run all checks, fill in the PR #10 description, and mark it ready.

## Decisions made while working

- **The optimizer takes a time budget and a clock**, so tests can run it for a fixed number of tries. The prototype stops after the first random try once its time is up. With a negative budget, that is exactly 41 tries, the same in the prototype and the engine.
- **The prototype's optimizer and quick layout are the reference**, including quirks. Any change is an owner decision.

## Tried and did not work

- The sheets fixture was 788 KB with indentation, so it is written compact (351 KB).

## Checks run

- Generator ran. `prototype-cabinets.json` came out byte-identical, so it is deterministic. `prototype-sheets.json` holds 3 starter scenarios (defaults, `rotBox`, kerf 3/16 with trim 1/4) and the synthetic cases. Quick sheets are 11/4/2, the optimizer ran 41 tries in every material, plywood is $1,710, and the page total is $3,178.46.
- Costs golden tests:
  - The engine-built starter cabinets plus the prototype's toe kick strips give the prototype's cut list.
  - Consumables (counts and basis text), plywood rows and material counts match for 3 scenarios.
  - Every line's count, packs, subtotal, tax and total, and the totals, match the money shown on the prototype page ($2,812.80 + $365.66 = $3,178.46).
  - The sheets suite has 41 tests.
- Cut step golden tests: every quick and optimized sheet in 3 scenarios, plus the synthetic case, matches the prototype page's text line for line. 35 tests in the sheets suite pass.
- Optimizer golden tests: 9 pass. Every scenario and material matches the prototype's raw layouts and accepted sheets after 41 tries, plus signatures and jobs. Behavior tests check repeatability, the time budget and progress, and that every part is placed once, inside the sheet, with no overlaps and grain respected. They also check the acceptance rule and the lower bound. A mutation check (changing the seed) failed the 3 cases where the random try won.
- Quick layout golden tests: 10 pass (3 scenarios × 3 materials, plus the synthetic case with its "does not fit" warnings).

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
