# Execution plan: BOOT-011 Runs on walls, corners, layout and project file v2 (M2 package 4)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Merged, go ahead with package 4". This implements ADR-003: cabinet runs on wall faces, corners found from the plan, the prototype's wall layout per run, the countertop, toe kick and platform runs, and project file version 2 with a migration from version 1. Work record BOOT-011. |
| Branch | `agent/claude/m2-runs-file-v2` |
| Pull request | #11 (draft) |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | In progress |

## Goal and done-when

- **Placement data:** a project holds cabinet runs (on a wall face, measured from one end), corners, items in one ordered list (each on a run or in a corner, with a position mode and snap), grain choices and the accepted sheet layouts.
- **Layout:** for a plan plus that data, the engine lays out every run exactly as the prototype's `layoutWalls` does: row starts, flow, fixed modes, snapping, gaps and every warning. It then gives the countertop runs, toe kick strips and platform runs.
- **Golden test:** the starter kitchen and other layouts drawn on a real plan match fixtures recorded from the prototype.
- **File version 2:**
  - It saves and opens the cabinet data with located error messages.
  - Version 1 files open unchanged, with empty cabinets.
  - The app carries cabinets through open, save, autosave and undo of an open, so nothing is lost before the cabinet UI exists.
- Typecheck, tests and build pass. The docs (data model, ADR-003 implementation notes, cabinet rules changes) and the review queue are updated.

**Out of scope:**

- the cabinet editing UI (package 5)
- 3D (package 6)
- the output panels and the optimizer worker (package 7)
- U-shaped kitchens: a corner at both ends of a run
- islands

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR (#11)
2. [x] `src/cabinets/project.ts`: saved types (`CabinetRun`, `CabinetCorner`, `CabinetItem` with position and snap, `CabinetsData`), `emptyCabinets()`, and display labels (B1, U1… in list order, as the prototype). Add the `stove` open-space kind to `build.ts`. Tests.
3. [x] `src/cabinets/runs.ts`: run geometry from the plan:
   - the collinear chain through the run's walls
   - face start and end points, direction, the normal into the room, and whether positions increase to the right as faced
   - usable length
   - openings mapped to run positions
   Tests.
4. [x] `src/cabinets/corners.ts`: inside corners where two runs start at the same face corner, with the owner run. Tests.
5. [~] Fixture generator: `tests/fixtures/prototype-layout.json`, with about 10 room and layout scenarios run through the prototype's `layoutWalls`, `renderWall` (countertop) and `addToeKick`. Each scenario is written in a neutral form the test can turn into a plan.
6. [ ] `src/cabinets/layout.ts`: port `layoutWalls` per run (row starts per corner, openings and stove blocks, fixed modes, flow, snapping, gaps, checks, sink and fridge checks)
7. [ ] `src/cabinets/layout.ts`: countertop runs, toe kick parts, platform runs. Add `planCabinets(plan, data, settings)`, which builds every item, lays out runs, and gathers parts and warnings.
8. [ ] Golden layout tests: each scenario drawn as an L-shaped plan with runs, a corner, a window opening and a stove item, compared with the prototype
9. [ ] Project file v2: `Project.cabinets`, serialize (`settings.cabinets` plus top-level `cabinets`), validation with located messages, migration 1→2, and `pruneCabinets` for runs whose walls are gone. Update the `main.ts` carry-through, `sample.ts` and the storage and file tests.
10. [ ] Docs:
    - `data-model.md` for v2
    - ADR-003 implementation notes
    - `cabinet-rules.md` changes (stove item, runs)
    - architecture, review queue R-019, work record, roadmap

    Then checks, PR description, mark ready.

## Next action

Step 5: extend `scripts/prototype-fixtures.mjs` with `LAYOUTS`. Each scenario is in neutral form:

```
{ name, room: { leftLen, rightLen, stoveWall, stoveFrom, stoveW, winWall, winFrom, winW, cornerOwner, gapAt },
  settings?, cabs: [{ input, wall, pos, at, snap, alignTo (index), alignSide }] }
```

- Run each through the prototype. Set `cabs`, call `fullCompute()`, and call `renderWall` on each wall for its countertop runs.
- Write `tests/fixtures/prototype-layout.json`: ids, the walls (starts, ends, items, gaps, window center, sink offset, countertop runs), warnings, toe kick parts and platform runs.
- Expose `setCabs`, `renderWall` and `computeIds` in the generator's copy of the page.

## Decisions made while working

- **Corner style comes from the cabinets.** A blind cabinet first on a run at the corner makes it a blind corner. A diagonal upper is an item placed in the corner. The corner record stores only the two runs and the owner, so it can never disagree with the cabinets. This refines ADR-003's "a corner stores … its base style … upper style" and is recorded as an implementation note there.
- **Labels follow the one ordered item list**, as the prototype's do (ADR-003 said "by run, then list order"). This keeps the starter kitchen's B1…U7 identical to the prototype. It goes in the ADR note.
- **The stove is an open-space item of kind `stove`.**
  - It takes its width plus the countertop overhang on each side.
  - It must have a fixed position.
  - In layout it acts like the prototype's stove opening: flowing cabinets jump past it, and fixed pieces that overlap it get "overlaps the stove". This keeps the prototype's behavior regardless of where the stove sits in the list.
  - It has no countertop and no toe kick.
- **Runs span the whole straight face.** A run stores the walls it was created on. It spans the maximal chain of collinear, end-to-end walls of the same thickness through them. The chain stops where another wall meets the run's face side. Splitting a wall therefore needs no update; deleting all of a run's walls makes the run invalid. `pruneCabinets` removes it, and package 5 will call that as an undoable change.
- **One corner per run, at its start end.** This matches the prototype. U-shaped kitchens are later.
- **Positions are measured from the run's start face corner,** like the prototype's "from the corner". `at` gives an item's start along the wall, including a stove's overhang.
- **D-003 (corner countertop) is not decided,** so the prototype's behavior is kept.
- **The file reader picks known fields and validates them,** the same as for walls today.

## Tried and did not work

None yet.

## Checks run

- Step 4: corner tests pass (11 in the runs suite): an L corner owned by the right wall by default, a saved owner kept, a stale corner reported, and an outside corner ignored.
- Step 3: `tests/cabinets-runs.test.ts` passes 7 tests: an L measured from the inside corner, `from: b`, openings mapped, a split wall with a backward second piece, walls meeting the back or the face, unsplit T, thickness change, and missing walls. One fix was in my test data: a T has to end on the other wall's centerline.
- Step 2: typecheck passes. The project and golden suites pass (99): labels match the prototype's numbering, and the stove space is 30 wide with 30 1/4 on the wall and 36 tall.

## Open questions for the owner

None blocking. D-003 and D-004 are still open in the review queue.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
