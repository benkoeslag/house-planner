# Execution plan: BOOT-010 Sheet layouts, optimizer, consumables and costs (M2 package 3)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Merged, go ahead with package 3". This covers sheet layouts, the optimizer, consumables and costs (see `docs/roadmap.md`, `docs/cabinet-rules.md` → Sheet layouts and Materials, counts and cost). Work record BOOT-010. |
| Branch | `agent/claude/m2-sheets-costs` |
| Pull request | to be linked (draft) |
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

1. [~] Create this plan, push it, and open a draft PR
2. [ ] Extend `scripts/prototype-fixtures.mjs` to write `tests/fixtures/prototype-sheets.json`. It records:
   - the starter kitchen's full computation (groups including toe kick, quick sheets, consumables, counts, and the money on the page)
   - synthetic nest cases (rotation, a part too big)
   - optimizer runs with a negative time budget, which gives exactly the 40 fixed tries plus 1 random one and is repeatable
   - cut step text for each sheet
3. [ ] `src/cabinets/sheets.ts`: material info, quick layout, warnings for parts that don't fit, plus a golden test
4. [ ] `src/cabinets/optimizer.ts`: both packers, the scoring, the fixed-seed tries, the time or try budget, the signature, the acceptance rule and the area lower bound, plus a golden test
5. [ ] `src/cabinets/cutsteps.ts`: strips, crosscuts, rips and leftovers as data, plus a golden test against the prototype's text
6. [ ] `src/cabinets/costs.ts`: consumables, plywood sheets with spares, material counts, cost lines with tax, and money formatting, plus a golden test against the page's numbers
7. [ ] Docs (architecture, cabinet rules status, review queue R-018, work record, roadmap), checks, PR description, mark ready

## Next action

Step 1: commit and push this file on `agent/claude/m2-sheets-costs`, then open the draft PR.

## Decisions made while working

- **The optimizer takes a time budget and a clock**, so tests can run it for a fixed number of tries. The prototype stops after the first random try once its time is up. With a negative budget, that is exactly 41 tries, the same in the prototype and the engine.
- **The prototype's optimizer and quick layout are the reference**, including quirks. Any change is an owner decision.

## Tried and did not work

None yet.

## Checks run

None yet.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
