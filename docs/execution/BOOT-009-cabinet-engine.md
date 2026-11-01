# Execution plan: BOOT-009 Cabinet engine (M2 package 2)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Go ahead with package 2". This is the cabinet engine: parts, hardware and the cut list, with golden tests from the prototype (see `docs/roadmap.md`, `docs/cabinet-rules.md`). Work record BOOT-009. |
| Branch | `agent/claude/m2-cabinet-engine` |
| Pull request | #9 |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | Ready for review |

## Goal and done-when

`src/cabinets/` turns one cabinet's inputs plus the cabinet settings into exactly the prototype's parts, fronts, hardware and warnings. It also turns a list of parts into the prototype's grouped, numbered cut list, with grain choices. This is done when:

- Golden tests compare the engine with fixtures generated from the prototype itself, covering every cabinet type and the settings that change the math, and they match.
- The worked examples in `cabinet-rules.md` are pinned in readable tests.
- Typecheck, tests and build pass. The docs and review queue are updated.

**Out of scope** (later packages):

- sheet layouts, the optimizer, consumables and costs (package 3)
- wall layout, corners on the plan, countertop, toe kick and file version 2 (package 4)
- any UI

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR (#9)
2. [x] Fixture generator: `scripts/prototype-fixtures.mjs` loads the unchanged prototype in headless Chromium and records `buildCab` output for a list of cases, plus a cut list. Commit the generated `tests/fixtures/prototype-cabinets.json`.
3. [x] `src/cabinets/settings.ts` (defaults from the prototype's `DEF`) and `src/cabinets/types.ts` (cabinet inputs, parts, fronts, hardware, warnings)
4. [x] `src/cabinets/build.ts`: boxes, doors, drawers, shelves, and the three base layouts
5. [x] `src/cabinets/build.ts`: blind base, blind upper, diagonal upper, gables, tall, open shelf, open spaces, custom parts
6. [x] `src/cabinets/cutlist.ts`: grain, grouping keys, order, numbering, banding length, hardware totals
7. [x] Tests: golden comparison with the fixtures, worked examples, and cut list behavior
8. [x] Docs (architecture, cabinet rules, review queue R-017, work record, roadmap), checks, PR description, mark ready

## Next action

None. Waiting for the owner to merge #9. The next package (3: sheet layouts, optimizer, consumables, costs) waits for the owner's go-ahead.

## Decisions made while working

- The engine takes typed numbers, not the prototype's text fields. Parsing typed text stays in the UI (package 5). Empty optional fields are `undefined`, meaning "use the default", exactly where the prototype uses its defaults.
- Settings keep the prototype's key names. `gapAt` ("leftover space goes") is kept as a project setting for package 4.
- The result keeps the prototype's field names (W, H, D, EW, hw, warns), so the golden tests compare directly with no mapping.
- The blind side is an input (`left` or `right` as faced). The prototype works it out from the wall (left wall → right). Package 4 will work it out from the run and corner.
- **Fixtures come from running the prototype**, not from hand math. The generator is a manual developer script. It needs Playwright, which is not a project dependency, and is not run in CI.

## Tried and did not work

- Two of my own test expectations were wrong; the engine was right in both, matching the prototype. First, a drawer count of 0 becomes 1, not 3 (`parseInt('0') || 1`). Second, "ignore grain on hidden parts" re-ticks a line already ticked. The tests now pin the prototype's behavior.

- The generator needs Playwright from the global install: `NODE_PATH=$(npm root -g) node scripts/prototype-fixtures.mjs` in this environment.

## Checks run

- Fixture generator ran: 91 cabinet cases and 4 cut lists, from the unchanged prototype. The starter cut list has 85 groups and 4027.10 in of banding.
- `tests/cabinets-golden.test.ts`: 92 pass. All 91 prototype cases match to 1e-9, including warning text, plus the settings defaults. A deliberate mutation (hinge threshold, drawer box rounding) made them fail, so the test does catch differences. Reverted.
- Cut list golden tests: all 4 starter kitchen cut lists match (default, `rotBox`, 1/16″ rounding, two ticked lines). `tests/cabinets.test.ts` pins the worked examples and cut list behavior. Full run: 14 files, 249 tests pass. Typecheck and build pass.
- Final checks: the Python copy of Test-Template passed (manifest files and every relative link). `npm ci`, typecheck, 249 tests and build all pass. The app bundle is unchanged: the app does not import the engine yet, and the fixtures are test-only.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
| 2026-11-01 | Claude Code (Opus 5.5) | Finished; PR #9 ready for review |
