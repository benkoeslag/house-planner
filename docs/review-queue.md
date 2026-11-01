# Review Queue

Status: Open. This is the list of work that has **not been independently reviewed** yet. The owner is merging packages as they finish and plans one large review later, by a different agent (ChatGPT/Codex). Every pull request adds its own items here. The reviewer works through the list and records results.

## How to use this list

- **Authors (any agent):**
  - Add one row per thing a reviewer should check, in the same pull request as the change.
  - Name the files, say what could be wrong, and give the risk.
  - Don't remove rows; a reviewer closes them.
- **Reviewer:**
  - Work top to bottom within each risk level, starting with **High**.
  - For each row, set **Result** to one of:
    - `OK`
    - `Fixed in #N`
    - `Issue #N`
    - `Owner decision needed`
  - Add a one-line note.
  - Findings go in a pull request or issues, never straight to `main`.
- **Owner:** the [Owner decisions](#owner-decisions-pending) section lists choices only you can make. A reviewer can give an opinion on them but does not settle them.

### Prompt for the reviewer

> Review the `benkoeslag/house-planner` repository. Read `AGENTS.md`, then work through `docs/review-queue.md`, High risk first. For each row, check the named files and tests against what the row asks, try to break it with concrete inputs, and record a Result and a one-line note in that row. Report real defects with a failing input; do not report style preferences. Cut sizes and the project file format are high risk: any change to their numbers or shape needs a test that pins the expected values. Put fixes and the updated queue in one pull request on a new branch; do not push to or merge `main`.

## Code and design review items

| ID | Risk | Area | Files | What to check | From | Result |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | High | Project file reading | `src/model/project-file.ts`, `tests/project-file.test.ts`, ADR-002 | `parseProject` never throws on any input (wrong types, nulls, huge or NaN numbers, prototype-polluting keys like `__proto__`). Every bad value gets a located message. Repeated ids and dangling `wallId`s are refused. Newer versions are refused. The migration chain runs in order. Save then open is an exact round trip. | #3, #6 | |
| R-002 | High | Wall corners | `src/model/walls.ts` (`wallGeometry`, `MITER_LIMIT = 6`), `tests/walls.test.ts` | Corner points are right for L corners, T junctions, X junctions (3+ walls at a point), odd angles, walls of different thickness, nearly straight joins, and very sharp angles (the square cut-off). Clear span and abutments are right. No NaN on zero-length or coincident walls. | #3 | |
| R-003 | High | Wall placement and splitting | `src/editor/ops.ts` (`placeWall`, `splitAt`, `crossing`, `moveEndpoint`), `src/model/plan-ops.ts` (`splitWall`, `removeWall`), `tests/editor-ops.test.ts`, `tests/plan-ops.test.ts` | Drawing a wall across, onto, or ending in the middle of other walls makes correct junctions. Openings stay on the right piece with the right offset after a split. A split through an opening is refused cleanly, with no half-applied change. Dragging a corner moves every wall end at that point and only those. | #3, #5 | |
| R-004 | Medium | Room detection and areas | `src/model/rooms.ts`, `tests/rooms.test.ts` | Rooms are found for nested rooms, rooms sharing walls, T-junction partitions, and walls dangling into a room. The outside region is never reported as a room. Areas are measured inside the walls. Room keys are stable, so names stay attached when unrelated walls change. | #3 | |
| R-005 | Medium | Length parsing and display | `src/model/units.ts`, `tests/units.test.ts` | `parseLength` accepts feet and inches in every form the README shows (`11' 10 3/8"`, `23-5/8`, decimals) and rejects negatives, junk and division by zero. `formatFraction` rounds up into the next whole inch correctly (for example 23.999 → `24`) and reduces fractions. | #3 | |
| R-006 | Medium | Opening checks | `src/model/openings.ts`, `src/editor/ops.ts` (`placeOpening`, `updateOpening`, `fromStartCorner`) | Openings into corners, past wall ends, overlapping, taller than the wall, and against abutting walls are all flagged. Distances "from the inside corner" match what the owner measures with a tape. | #3, #5 | |
| R-007 | Medium | Autosave and storage | `src/storage.ts`, `src/main.ts`, `tests/storage.test.ts` | A damaged or newer autosave is copied to the backup key before anything overwrites it. Blocked or full storage never breaks the app. The 500 ms timer plus `pagehide`/`visibilitychange` doesn't lose the last change. The startup order is safe (the `editorReady` guard). | #6 | |
| R-008 | Medium | Undo and history | `src/editor/history.ts`, `src/editor/editor.ts` (`load`, `afterHistoryMove`), `src/main.ts` (`namesByPlan`) | Undo and redo across Open file restore both the plan and the project name. No action skips history or records twice. Failed operations leave no history entry. | #5, #6 | |
| R-009 | Low | 3D wall pieces | `src/view3d/pieces.ts`, `tests/pieces.test.ts` | Walls are cut correctly around doors and windows: sill, head, openings at wall ends, openings as tall as the wall. Mitered corners match the plan. Meshes are disposed when the plan changes (no GPU memory growth). | #4 | |
| R-010 | Low | Editor input | `src/editor/editor.ts`, `src/editor/snap.ts`, `src/editor/hit.ts` | Typed length and angle, 90° snapping, snapping to corners and walls, pinch and wheel zoom, and keyboard shortcuts all behave. The view anchoring when the length bar opens (an earlier bug) stays fixed. | #5 | |
| R-011 | Low | CI and process | `.github/workflows/app-ci.yml`, `scripts/Test-Template.ps1` | CI uses the runner's Node with a version check instead of `actions/setup-node`, because the agent could not reach that action. Confirm this is acceptable or pin `setup-node`. The PowerShell template check has never been run by an agent; it was replicated in Python each time, so run it once for real. | #2–#7 | |
| R-012 | Low | Template drift | `AGENTS.md`, `docs/model-roster.md` | `benkoeslag/fish-sticks` has a newer `AGENTS.md` than `project-template` (vendor preference section, roster dates). Decide whether to bring this repository up to date. | #1 | |
| R-013 | High | Cabinet placement model and file v2 | `decisions/ADR-003-cabinet-runs-and-file-v2.md` | Can runs on wall faces (including runs across collinear wall pieces) later describe islands, peninsulas, outside corners and more corner styles without another format break? Check the sketched version 2 shape, the stable ids, saving the optimized layout in the file, and the stove as an item instead of an opening. | #7 | |
| R-014 | High | Cabinet rules accuracy | `docs/cabinet-rules.md` vs `docs/prototype/cabinet-planner.html` (`buildCab`, `buildDiag`, `layoutWalls`, `nest`, `workerMain`, `consumables`) | Spot-check that the written rules match the prototype source, especially the blind corner (`blindX`, `y0`, drawer partition), the diagonal corner, snapping and the single leftover gap, the countertop overhang, and the consumables formulas. The worked examples came from running the prototype and should be right; the prose around them is where errors would be. | #7 | |
| R-015 | Medium | M2 requirements | `docs/requirements.md` (CAB-001 to CAB-006) | Is each acceptance criterion testable and complete? Is anything the prototype does missing from them? | #7 | |
| R-016 | Medium | Execution plan governance | `AGENTS.md` (Execution plans, Git rules), `docs/execution/`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/github-workflow.md` | Can a fresh agent really resume from a plan alone? Are the rules clear for Codex as well as Claude? Do draft PRs and frequent pushes fit the CI and branch rules? Does the template wording match house-planner? | #8 |  |
| R-017 | High | Cabinet engine | `src/cabinets/build.ts`, `src/cabinets/cutlist.ts`, `tests/cabinets-golden.test.ts`, `scripts/prototype-fixtures.mjs` | Compare the engine with the prototype for inputs the 91 fixture cases don't cover: odd widths, extreme settings, a groove depth of 0 with other changes, very narrow blind corners, many drawers, and custom parts in every material. Check that `toProto()` in the generator maps engine inputs to the prototype's text fields faithfully, since a wrong mapping would make the fixtures prove the wrong thing. Look for any part, quantity, banding, note or hardware count that differs. | #9 | |
| R-018 | High | Sheet layouts, optimizer and costs | `src/cabinets/sheets.ts`, `optimizer.ts`, `cutsteps.ts`, `costs.ts`, `tests/cabinets-sheets-golden.test.ts` | Is every part placed exactly once, inside the trimmed sheet, with kerfs between cuts, no overlaps, and grain respected? The tests check this for the starter kitchen only; try other part mixes, kerf and trim values, and parts bigger than a sheet. Does the optimizer ever keep a layout worse than the quick one? Are the cut steps correct for the real saw sequence? Do the consumables and cost totals match the prototype for other kitchens? Is the money rounding right? The golden optimizer test covers 41 tries only; longer runs are checked by the placement tests, not against the prototype. | #10 | |
| R-019 | High | Runs, layout and file version 2 | `src/cabinets/runs.ts`, `corners.ts`, `layout.ts`, `project.ts`, `src/model/project-file.ts`, `src/main.ts`, `tests/cabinets-layout-golden.test.ts`, `tests/project-file-v2.test.ts` | Version 1 files must open unchanged and version 2 files must round-trip exactly. Is any value accepted that should be refused, or the reverse? Is the leniency for dangling wall and opening references safe? Check run geometry on odd plans: non-right angles, walls drawn in either direction, T junctions, different thicknesses. Check corner detection on L, U and outside corners. Does the layout match the prototype beyond the 12 scenarios? Check the stove-as-item and upper-centered-on-a-window behavior. Do cabinets survive every path in `main.ts` (open, undo, redo, autosave restore)? Known limits: one corner per run (no U kitchens); the editor does not prune cabinets yet when walls are deleted (package 5). | #11 | |
| R-020 | Medium | Cabinet editing UI | `src/editor/editor.ts`, `cabinet-panel.ts`, `cabinet-overlay.ts`, `history.ts`, `src/cabinets/ops.ts`, `src/main.ts`, `tests/cabinets-ops.test.ts` | Can any panel or plan action leave cabinets the file reader refuses? The random-edit test covers the pure edits, not the panel handlers. Do undo and redo always restore plan and cabinets together, including corner drags and opening a file? Is the start end chosen for a new run sensible on real plans (rooms with many walls, odd angles)? Check typed-length parsing in every field, and keyboard, focus and screen-reader behavior in the panel. Is it usable on a phone, given the panel sits below the plan? Known cosmetic issue: wall face lengths can overlap cabinet footprints. | #12 | |

## Owner decisions pending

These are choices for the owner. A reviewer may comment on them.

| ID | Decision | Where | From | Decided |
| --- | --- | --- | --- | --- |
| D-001 | Accept, change or reject ADR-003 (cabinet runs, corners, file version 2) | `decisions/ADR-003-cabinet-runs-and-file-v2.md` | #7 | Accepted 2026-11-01 ("go ahead with package 4"); implementation notes added in #11 |
| D-002 | Accept CAB-001 to CAB-006, and confirm the acceptance tests use the prototype's starter kitchen (the SketchUp layout) | `docs/requirements.md` | #7 | |
| D-003 | Corner countertop is counted on both walls. Fix it (proposed: the corner wall's top runs into the corner, and the other wall's top starts at the base depth) or keep it. | `docs/cabinet-rules.md` → Prototype quirks 1 | #7 | |
| D-004 | Other prototype quirks 2–6: the toe kick behind the corner, toe kick feet in the shopping list, the shelf sag threshold, finding the sink by type, the fixed 70″ fridge height | `docs/cabinet-rules.md` → Prototype quirks | #7 | |
