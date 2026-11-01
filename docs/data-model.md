# Data Model

Status: Version 1 of the plan model and project file, from M1 package 2. Code lives in `src/model/`; the file format decision is [ADR-002](../decisions/ADR-002-project-file-format.md).

## Units and coordinates

- Every length is in **inches**, stored as a decimal number (for example `23.625`). The app shows lengths as fractions (`23 5/8″`) or feet and inches (`11′ 10 3/8″`), and reads either when typed.
- The plan is seen from above. `x` points east, `y` points north. Counterclockwise is the positive direction.
- Two points within **0.01″** of each other are treated as the same point (`JOIN_TOLERANCE`). New walls snap their ends to existing wall ends within that distance, so walls connect exactly.

## Entities

| Entity | Fields | Notes |
| --- | --- | --- |
| Project | `name`, `settings`, `plan` | One project per file. |
| Settings | `wallThickness`, `wallHeight` | Defaults for new walls: 4 1/2″ thick, 96″ tall. |
| Plan | `walls`, `openings`, `roomLabels` | |
| Wall | `id`, `a`, `b`, `thickness`, `height` | A straight wall described by its **centerline** from point `a` to point `b`. Left and right faces are named looking from `a` toward `b`. |
| Opening | `id`, `wallId`, `kind` (`door`, `window`, `opening`), `offset`, `width`, `height`, `sill`, optional `swing` | `offset` is measured along the wall centerline from `a` to the near edge of the opening. `sill` is the height of the bottom above the floor. A door `swing` names the hinge edge (`start` nearest `a`, or `end`) and the side it swings into (`left` or `right`, looking from `a`). |
| Room label | `id`, `name`, `at` | A name pinned to a point. A detected room takes the name of the label inside it. |

Rooms are **not stored**. They are found from the walls each time (`detectRooms`), so they always match the walls. Each detected room has a `key` built from its corner positions, a centerline outline, an inside outline along the wall faces, and the floor area inside the walls.

## Derived geometry

- **Wall corners** (`wallGeometry`): at every point where walls meet, each wall end gets two corner points where its faces meet the faces of its neighbors. This handles L corners, T junctions (a wall ending against the middle of another), odd angles, and walls of different thickness. Corners further than 6 half-thicknesses from the junction (very sharp angles) are cut square instead.
- **Faces and clear span**: each wall reports the usable length of each face and the stretch where an opening can cut through both faces without hitting a corner. Walls ending against its middle are listed as **abutments**.
- **Opening checks** (`validateOpenings`): an opening must have a positive size, stay within the wall, stay clear of corners and abutting walls, not overlap another opening on the same wall, and not be taller than the wall.

## Invariants

- Every `id` is unique across walls, openings and room labels.
- Every opening's `wallId` names an existing wall.
- Thicknesses, heights, and opening widths and heights are greater than 0; offsets and sills are 0 or more.
- Zero-length walls are ignored by geometry and refused by the editing operations.
- Walls that cross without sharing an endpoint are not joined. A T junction needs the end of one wall to lie on the other; crossing walls should be split where they cross.

## Persistence and migration

- Projects are saved as JSON files (`serializeProject`) with `format: "house-planner"`, a `version`, and `units: "in"`. The current version is **1**.
- Reading (`parseProject`) never throws. It returns the project or a plain-language error that names the bad value's location, for example `plan.walls[1].thickness must be more than 0`.
- A file from a **newer** version is refused with a message to update the app. An **older** file is upgraded step by step through `MIGRATIONS`, keyed by the version each step upgrades from. Version 1 is the first format, so there are no migrations yet.
- Any change to the saved shape must bump `FILE_VERSION`, add a migration from the previous version, and add a test that opens a file in the old format.
- There is no server and no database. Backups are the owner's saved files.
- **Autosave** (`src/storage.ts`): the project is written to browser storage under `house-planner:autosave` about half a second after each change, and again when the page is hidden or closed. On start it is read back through `parseProject`, so it gets the same checks and migrations as a file.
- **An autosave that cannot be read** (damaged, or from a newer version) is never overwritten silently: its text is first copied to `house-planner:autosave-unreadable`, the app starts with the sample room, and says so.
- **Storage blocked or full:** the app says so and keeps working; **Save file** is the fallback.
- **Open file** is an undoable change, and undo or redo also restores each plan's project name.
- Undo history is not saved; it lasts until the page is closed.
