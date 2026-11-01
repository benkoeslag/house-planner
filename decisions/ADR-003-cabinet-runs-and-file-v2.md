# ADR-003: Cabinet runs on the plan, and project file version 2

- Status: Accepted
- Date: 2026-11-01
- Decision maker: Repository owner (`benkoeslag`); accepted by approving M2 package 4 on 2026-11-01
- Issue / PR: M2 package 1 (see `docs/roadmap.md` and `docs/work-record.md` BOOT-007)
- Supersedes / superseded by: None. Extends [ADR-002](ADR-002-project-file-format.md).

## Context

M2 carries the cabinet planner prototype into House Planner. The owner asked on 2026-11-01 to carry everything over, preserve the prototype first, and defer islands. The prototype's rules are written out in [`docs/cabinet-rules.md`](../docs/cabinet-rules.md).

The prototype only knows one kitchen. It has a left wall and a right wall meeting at one inside corner, typed-in wall lengths, one stove and one window. Every position is measured from that corner. House Planner already has the real walls, openings and rooms. Cabinets need to sit on any wall of the plan, read their limits from it, and be saved in the project file. Whatever goes into the file must keep opening in later versions (ADR-002). Islands, peninsulas and more corner styles will come later and should not force another break.

## Options considered

| Option | Benefits | Costs and limitations |
| --- | --- | --- |
| **Runs on wall faces.** A run is a straight stretch along one face of one or more joined walls. It has a base row and an upper row. Corners are found from the plan. | Matches how cabinets are built and installed. Every prototype rule applies to a run as it did to a wall. Openings and wall lengths come from the plan. A later free-standing run (island) is a new kind of run, not a new model. | Runs must follow wall edits. Splitting or deleting a wall has to update or remove its runs. |
| **Cabinets placed freely in plan coordinates** (x, y, angle) | Islands and odd layouts are free | Loses the prototype's snapping, gaps, corner and countertop logic, which all assume a row along a wall. Cabinets drift when a wall moves. |
| **Keep the prototype's two-wall kitchen as a separate page** with typed lengths | Least work | Does not use the plan. It is a second source of truth for the same walls. It cannot do a second kitchen, a laundry room or a bathroom vanity. |

## Decision

Use **runs on wall faces**.

1. **Runs.** A run belongs to one face (`left` or `right`, as named in `docs/data-model.md`) of an ordered chain of one or more **collinear walls joined end to end**. A face that is broken only by a wall meeting the *other* side still makes one run. A run measures positions from its **start end** (`a` or `b` of the chain) along the face, starting at the inside corner, exactly as the prototype measures from the corner. Its usable length is the face length between corners. "Left" and "right" in snapping and lining up are as you face the run.
2. **Rows.** Each run has a base row and an upper row. Full-height items (talls, fridges, full-height panels) sit in the base row and block the upper row, as in the prototype. All the layout rules in `cabinet-rules.md` apply per run: flow, fixed modes, snapping, one gap per stretch, warnings, countertop, toe kick.
3. **Corners.** Where two runs meet at an inside corner of the same room, a corner is found automatically from the wall geometry. A corner stores:
   - which run owns it (the prototype's "corner cabinets belong to")
   - its base style: open, or a blind corner (the blind cabinet is the owner run's first base)
   - its upper style: open, blind, or diagonal

   Row starts, `y0`, and the corner checks follow `cabinet-rules.md`. Other styles (a lazy Susan, or a corner on an outside corner) can be added later as new style values.
4. **Openings from the plan.**
   - A window on the run's wall blocks the upper row over its width.
   - A door or a full-height opening blocks both rows.
   - A window with a sill below countertop height also blocks the base row and gets a warning.
   - "Centered on the window" becomes "centered on an opening", which names a plan opening by id.
5. **Appliances are items.** The stove, dishwasher, fridge and open spaces are items in a row, like the prototype's open spaces.
   - A **stove space** takes its width plus the countertop overhang on each side, so the countertop edges land on the space, exactly as the prototype's stove opening did.
   - "Centered on the stove" becomes "lined up with an item", which already exists for uppers over bases. It is extended to any item, by id, left, right or center.
6. **Stable ids.** Items, runs and corners have stable ids, like walls and openings. The B1, U1, T1 labels are only display labels, computed in a fixed order: by run, then list order. References (line up with, follow) use ids, so renumbering never breaks them.
7. **Settings in the project.** Every construction setting, sheet size and price from `cabinet-rules.md` is a project setting. A new project gets the prototype's defaults. Per-part grain choices and the accepted optimized sheet layout (with its signature) are saved with the project, so the layout the owner cuts from survives closing the browser.
8. **Project file version 2.** The file gains a `cabinets` section:

   ```json
   {
     "format": "house-planner", "version": 2, "units": "in", "name": "...",
     "settings": { "wallThickness": 4.5, "wallHeight": 96, "cabinets": { "boxT": 0.71875, "...": "..." } },
     "plan": { "walls": [], "openings": [], "roomLabels": [] },
     "cabinets": { "runs": [], "corners": [], "items": [], "grainFree": [], "sheetLayouts": null }
   }
   ```

   - Each run has an `id`, a `kind` (only `"wall"` in version 2), `wallIds`, `face` and `from`.
   - Each item has an `id`, a `runId`, a `row`, a `type`, its fields from `cabinet-rules.md`, and its place in the run's list.
   - The migration from version 1 adds an empty `cabinets` section and the default cabinet settings. A version 1 file opens unchanged otherwise.
   - Missing cabinet settings in a version 2 file are filled from the defaults. Unknown values are refused with a located message, as ADR-002 requires.
9. **Islands are deferred.** Islands and peninsulas will be a new run `kind` (for example `"free"`, with a position and angle instead of `wallIds`), added in a later file version. Version 2 runs stay valid as they are.
10. **Prototype numbers are the reference.** The engine reproduces the prototype's parts, sizes, hardware, consumables and costs for the same inputs. The golden tests pin the worked examples in `cabinet-rules.md`. Any change from the prototype is an owner decision recorded in that document.

## Consequences

- **Plan edits.**
  - **Splitting a wall** that carries a run keeps the run on the same face. The split pieces stay in the run's chain, because they are collinear.
  - **Deleting a wall** removes its runs and their items, as an undoable change with a message.
  - **Moving a wall** keeps items at their distances from the run start. Items that no longer fit get the usual "runs past the end" problem rather than being moved silently.
- The editor gets a cabinet mode (package 5). The 3D view draws boxes, fronts and countertops on the runs (package 6). Cut list, sheets and costs move into app panels (package 7).
- **File format and tests.** The file format is a high-risk area (AGENTS.md). Version 2 needs:
  - a migration test that opens a version 1 file
  - a round-trip test with cabinets
  - located error tests for bad cabinet values
- **Reproducibility.** The optimizer's result depends on a time budget, so it is not exactly reproducible. Saving the accepted layout keeps what the owner cut from. A stale layout (its signature no longer matches) is shown as stale and not used.
- **Prototype quirks.** The quirks listed in `cabinet-rules.md` (for example the corner countertop counted on both walls) are kept until the owner decides. Each decision updates that document and its tests.
- **The prototype file** stays in `docs/prototype/`, unchanged, as the reference.

## Implementation notes (M2 package 4, 2026-11-01)

These refine the decision without changing it. The owner accepted this ADR by approving package 4.

- **Corner style comes from the cabinets.**
  - A blind cabinet first on either run makes a blind corner.
  - A diagonal upper is an item placed in the corner (`cornerId`).
  - The saved corner keeps only its two runs and the owner, so it can never disagree with the cabinets.
- **Labels are numbered in list order.** B1, U1 and so on follow the single item list, as the prototype numbers them, rather than "by run, then list order". This keeps the starter kitchen's labels identical to the prototype's.
- **The stove space is an item of kind `stove`.**
  - It takes its width plus the countertop overhang on each side, and its `at` position is where that starts.
  - In layout it acts exactly like the prototype's stove opening: cabinets in list order jump past it, and fixed pieces that overlap it are flagged.
  - It gets no countertop and no toe kick.
- **A run spans the whole straight face** through the walls it was created on, so splitting a wall needs no update. A wall meeting the run's face, whether split there or not, ends the run.
- **One corner per run, at its start**, as in the prototype. U-shaped kitchens, with a corner at both ends of a run, are a later change.
- **`sheetLayouts` is a list** of accepted layouts, one per material, each with its signature. An empty list means none, rather than `null`.
- **References to the plan may dangle in the file.** A run whose walls were deleted, or an item centered on a deleted window, is kept and reported by the layout. Refusing such a file would make an ordinary wall deletion turn the autosave unreadable. References inside the cabinets section are checked strictly.

## Validation and references

- The prototype's numbers are in `docs/cabinet-rules.md` → Worked examples. They were taken from the prototype itself in headless Chromium on 2026-11-01.
- Packages 2 and 3 pin those numbers in golden tests. Package 4 adds the version 2 migration and file tests.
- **M2 acceptance:** with the starter kitchen drawn on the plan, the app gives the same parts, sheets, hardware and total as the prototype (CAB-001 to CAB-004 in `docs/requirements.md`).
