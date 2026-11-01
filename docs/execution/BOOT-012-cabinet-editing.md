# Execution plan: BOOT-012 Cabinet editing in the plan editor (M2 package 5)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Merged, go ahead with package 5". The owner can plan cabinets on any wall in the editor: pick a wall face, add, edit, reorder and delete cabinets with typed sizes, set position, snap and corner choices, see the problems, undo everything, and have cabinets cleaned up when their wall is deleted. Work record BOOT-012. |
| Branch | `agent/claude/m2-cabinet-editing` |
| Pull request | #12 |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | Ready for review |

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
3. [x] `src/cabinets/ops.ts`, pure cabinet edits:
   - `runForFace` (find, or a new run with the start end chosen)
   - `removeRun`, `updateRun`
   - `addItem`, `updateItem`, `moveItem`, `removeItem`
   - `setCornerOwner`, `addDiagonal`
   - default inputs per type, as the prototype's `newCab`

   `RunGeometry` gains its start and end joints. Tests include a random-edit test that every result still saves and opens.
4. [x] Plan overlay: cabinet footprints and labels in `plan-canvas.ts`, from `planCabinets`, plus the Cabinets tool (toolbar button, click a wall face, hover).
5. [x] Cabinet panel: run header, row tabs, item cards (label, type, width, position, snap, up/down, delete), add buttons (`src/editor/cabinet-panel.ts`)
6. [x] Item details (type-specific fields), corner section (owner, diagonal), run actions (rename, flip, delete), problems list
7. [x] Browser check: build, preview, and script the flows at desktop and phone width: create runs on an L, add cabinets, type sizes, center the sink on the window, undo and redo, delete a wall then undo, save and reopen. Take screenshots and fix what looks wrong.
8. [x] Docs (README "Using the editor", architecture, review queue R-020, work record, roadmap), checks, PR description, mark ready

## Next action

None. Waiting for the owner to merge #12. Package 6 (cabinets in 3D) waits for the owner's go-ahead.

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

- **Owner bug report after the PR was ready:** text typed into any text box is not visible. Typed into the project name, run name, cabinet name and width boxes in headless Chromium in light, dark, forced-dark and forced-colors modes: the text is visible in all of them, so it is **not reproduced**. Added explicit text colors to every form control as a precaution (`src/style.css`). Asked the owner for browser, device and what exactly they see.

- The first flow script read the autosave before its half-second delay and saw nothing; adding a wait fixed it. A JSON-text comparison after reopening differed only by key order; a structural comparison is equal.

None yet.

## Checks run

- Final: the Python copy of Test-Template passed. `npm ci`, typecheck and build pass, and **338 tests** pass (20 files). The bundle is 696 KB, up 50 KB now that the cabinet engine is used by the app.

- Step 7: full flows (`m2/ui2.js`, `m2/ui3.js`), all with no page errors:
  - named runs, typed `13 7/8` and `1' 8 15/16"`
  - a sink base auto-centered on the window, the dishwasher set to follow it, moved up and down within its row
  - snap left, an upper centered on the sink, a diagonal corner upper, the corner owner changed
  - undo ×3 and redo ×3 restore exactly
  - deleting the south wall removed its run and 5 cabinets with a message, and undo restored them exactly
  - reload (autosave) and save then reopen are identical (structural comparison)
  - desktop and phone (390×844) screenshots
  - Fixed: upper labels overlapped base labels; uppers now label near the wall and floor cabinets toward the front.
- Steps 4–6: first browser run (`ui1.js`, desktop 1400×860). Clicking in front of each wall creates two runs that both start at the shared corner. Added cabinets of several types, a stove space at 56″, uppers and a diagonal corner upper: 13 footprints drawn and labeled, problems outlined in red (B5 runs into the sink, as the prototype would say), no page errors. Screenshot `m2/cab-desk.png`.
- Step 3: `tests/cabinets-ops.test.ts` passes 11 tests. These cover the start-end rule, finding an existing run, rename and flip, defaults, moving within run and row, line-ups reset on remove, run removal, corner owner and diagonal, and 25 random 40-step edit sequences, each step saving and reopening identically. My first test helper changed the result it returned; that was fixed. Full suite: 338 tests.
- Step 2: typecheck passes, 327 tests pass, build passes, and `appcheck.js` (scratchpad) still shows cabinets kept through autosave, open and undo.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
| 2026-11-01 | Claude Code (Opus 5.5) | Finished; PR #12 ready for review |
