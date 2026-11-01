# Execution plan: BOOT-012 Cabinet editing in the plan editor (M2 package 5)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Merged, go ahead with package 5". The owner can plan cabinets on any wall in the editor: pick a wall face, add, edit, reorder and delete cabinets with typed sizes, set position, snap and corner choices, see the problems, undo everything, and have cabinets cleaned up when their wall is deleted. Work record BOOT-012. |
| Branch | `agent/claude/m2-cabinet-editing` |
| Pull request | #12 (draft) |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | In progress |

## Goal and done-when

- **The Cabinets tool:** clicking a wall face selects its run, or creates one measured from a sensible end (an inside corner, preferably one another run starts at). Cabinets show on the plan as footprints with labels: base and tall solid, uppers dashed.
- **The run panel:**
  - the run's name, which end it is measured from, and delete
  - Base and Upper rows, as in the prototype
  - each cabinet's width and type-specific sizes, typed as lengths
  - position mode (list order, centered on a door or window, at a distance, lined up, after the fixed piece) and snap
  - move up and down, delete
  - add buttons for every type, including the stove space
  - the corner owner and a diagonal corner upper
  - the problems for this run
- **One undo history** for walls and cabinets. Deleting a wall removes its cabinets in the same undoable step, with a message.
- No edit can leave the cabinets in a state the file reader refuses. A random-edit test checks this.
- Checked in a real browser at desktop and phone width. Typecheck, tests and build pass. The docs and review queue are updated.

**Out of scope:**

- cabinets in 3D (package 6)
- cut list, sheet and cost panels, cabinet construction settings and prices, and the optimizer worker (package 7)
- U-shaped kitchens
- islands

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR (#12)
2. [x] One history for plan and cabinets:
   - `History` becomes generic, and the editor keeps `{ plan, cabinets }`.
   - A wall change prunes cabinets on deleted walls, with a message.
   - `load(plan, settings, cabinets)`.
   - `main.ts` takes cabinets from the editor; `cabinetsByPlan` goes.
   - Existing tests pass, and the app check still passes.
3. [~] `src/cabinets/ops.ts`, pure cabinet edits:
   - `runForFace` (find, or a new run with the start end chosen)
   - `removeRun`, `updateRun`
   - `addItem`, `updateItem`, `moveItem`, `removeItem`
   - `setCornerOwner`, `addDiagonal`
   - default inputs per type, as the prototype's `newCab`

   `RunGeometry` gains its start and end joints. Tests include a random-edit test that every result still saves and opens.
4. [ ] Plan overlay: cabinet footprints and labels in `plan-canvas.ts`, from `planCabinets`, plus the Cabinets tool (toolbar button, click a wall face, hover).
5. [ ] Cabinet panel: run header, row tabs, item cards (label, type, width, position, snap, up/down, delete), add buttons (`src/editor/cabinet-panel.ts`)
6. [ ] Item details (type-specific fields), corner section (owner, diagonal), run actions (rename, flip, delete), problems list
7. [ ] Browser check: build, preview, and script the flows at desktop and phone width: create runs on an L, add cabinets, type sizes, center the sink on the window, undo and redo, delete a wall then undo, save and reopen. Take screenshots and fix what looks wrong.
8. [ ] Docs (README "Using the editor", architecture, review queue R-020, work record, roadmap), checks, PR description, mark ready

## Next action

Step 3: add `startJoint` and `endJoint` to `RunGeometry` in `src/cabinets/runs.ts`. These are the centerline points at the chain's start and end.

Then write `src/cabinets/ops.ts`, pure functions on `CabinetsData`:

- `defaultInput(type)`, as the prototype's `newCab`
- `runForFace(plan, data, wallId, face, click)` returns `{ data, runId }`. It uses the start-end rule in "Decisions".
- `updateRun`, `removeRun`
- `addItem` (at the end), `updateItem`, `moveItem` (swap with the neighbor in the same run and row), `removeItem` (line-ups to it go back to flow)
- `setCornerOwner` and `addDiagonal`, which save the resolved corner

Tests in `tests/cabinets-ops.test.ts`, including random edit sequences: after each, `parseProject(serializeProject(...))` must succeed and `planCabinets` must not throw.

The preview server may still be running on port 4173. Stop it with `pgrep -f "[v]ite.*preview"`.

## Decisions made while working

- **The editor owns the cabinets** in its history, so walls and cabinets undo together and a wall deletion that removes cabinets is one step.
- **New cabinets go at the end of the list**, as in the prototype. They are moved up and down within their run's row.
- **Choosing the start end of a new run,** in order:
  1. An end where another run already starts, at an inside corner.
  2. Otherwise an end at an inside corner.
  3. Otherwise the end nearer the click.

  "Measure from the other end" flips it.
- **Items centered on a deleted door or window keep that setting** and show a problem, rather than silently changing.
- **Construction settings and prices wait for package 7,** together with the outputs they change.

## Tried and did not work

None yet.

## Checks run

- Step 2: typecheck passes, 327 tests pass, build passes, and `appcheck.js` (scratchpad) still shows cabinets kept through autosave, open and undo.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
