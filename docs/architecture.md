# Architecture

Status: Draft. No application architecture has been accepted.

## Repository and collaboration architecture

GitHub is the durable shared source of truth. A clean `main` checkout is the owner's review copy. Each active agent uses a separate Git worktree and dedicated branch. Pull requests carry implementation, validation, and review history; only the human owner merges.

```text
main checkout (owner review)
        |
        +-- project-claude worktree -> Claude branch -> PR
        |
        +-- project-codex worktree  -> Codex branch  -> PR/review
```

## Application boundaries and components

Users, external systems, deployment boundary, trust boundaries, runtime, components, interfaces, and data ownership are `TBD`. The accepted direction is a single-user, client-only application with no accounts, server, or external services.

## Technology decisions

| Decision | Status | ADR |
| --- | --- | --- |
| Application runtime and framework | Accepted: browser application in TypeScript, built with Vite, with three.js for the 3D view and Vitest for tests | [ADR-001](../decisions/ADR-001-application-stack.md) |
| Persistence | Accepted: project files (JSON, inches) saved and opened locally, plus browser storage for autosave; no server or database | [ADR-001](../decisions/ADR-001-application-stack.md) |
| Hosting and deployment | Proposed / `TBD` | Create before deployment work |

## Operations and risks

Local Git/VS Code operations are documented in `local-development.md`. Application configuration, environments, secrets, deployment, monitoring, backups, restore, and rollback remain `TBD`.

## 3D viewer

`src/view3d/`: `pieces.ts` turns a plan into solid wall pieces and window panes (pure geometry, covered by tests), and `plan-view.ts` draws them with three.js. One 3D unit is one inch; plan x is 3D x, plan y is 3D -z, and up is 3D y.

- **Wall openings are real holes.** Each wall's outline is sliced at the edges of its doors, windows and openings. The slices beside an opening are full height; a piece under a window and a header over any opening fill the rest. Slicing keeps the mitered corners from `wallGeometry`, so no boolean (CSG) library is needed, and the removed volume is exactly width x thickness x opening height.
- **Floors** come from the detected rooms' inside outlines. A thin pane fills each window.
- **Camera:** orbit, pan and zoom with mouse or touch (three.js `OrbitControls`). The camera keeps its position when the plan changes, except the first time a plan with walls is shown; `fitToPlan` re-aims it.
- **Drawing** happens on the next animation frame after a change, and only then, so an idle page does no work.
- **Hook:** `window.houseplanner.setPlan(plan)` and `fitToPlan(plan)` redraw the view. The floor plan editor (package 4) will call the view directly; the hook also allows trying plans from the browser console.

## Floor plan editor

`src/editor/`: pure logic with tests, plus the screen code.

| File | Role |
| --- | --- |
| `snap.ts` | Snapping a pointer to wall ends, walls or the inch grid; 90-degree angle snapping; where the wall being drawn ends (typed length and angle win over the pointer) |
| `ops.ts` | Editing operations on the plan: placing walls with proper junctions (ends snap to wall ends, an end in the middle of a wall splits it, crossing walls are split at the crossing), changing a wall's length (walls joined at the moved end follow), moving corners, placing and changing openings measured from the inside corners, naming rooms |
| `history.ts` | Undo and redo. Plans are immutable, so history keeps references |
| `hit.ts` | What is under the pointer: a corner, a door or window, or a wall |
| `plan-canvas.ts` | Draws the plan as SVG in screen coordinates: grid, floors, walls, openings with door swings, face lengths on both sides of each wall, room names and areas, the wall being drawn, and snap markers |
| `editor.ts` | Tools, pointer and keyboard handling (mouse, touch and pinch), the typed-length bar, and the properties panel |

The editor tells `main.ts` about every change; `main.ts` rebuilds the 3D view at most once per animation frame. The 2D view keeps its top-left corner still when its size changes, so the plan never shifts under the pointer while drawing.
