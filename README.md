# House Planner

A planning tool for the owner's house: draw the main floor as a floor plan, see it in a simple 3D view, and plan built-in cabinetry against the real walls, then produce cut lists, sheet layouts and cost estimates for building it.

The project is developed by the owner and multiple coding agents, primarily Claude Code and OpenAI Codex. GitHub is the shared source of truth, and all substantive changes flow through reviewable pull requests that only the owner merges.

## Status

Milestone M0 (foundation) is done: the governance and workflow from [`benkoeslag/project-template`](https://github.com/benkoeslag/project-template) are in place. Milestone M1 (floor plan editor and 3D viewer) is in progress. The app has the floor plan editor next to the 3D view; saving and opening files is the last M1 package, so a reload currently starts again from the sample room.

What the owner has decided so far is recorded in [`docs/product-vision.md`](docs/product-vision.md) and [`docs/roadmap.md`](docs/roadmap.md). The application stack is a TypeScript browser app (Vite, three.js, Vitest); see [`docs/architecture.md`](docs/architecture.md).

## Planned scope

- **Floor plan editor** for the main floor: walls drawn by typed measurements, doors, windows, rooms and dimensions. A ceiling plan may follow.
- **Simple 3D viewer** generated from the floor plan, needed from the first milestone.
- **Cabinet planning on any wall**, carrying over a working prototype built during planning: frameless 3/4" maple plywood boxes, fixed pieces, snapping, gables, blind and diagonal corners, cut lists, sheet layouts with an on-demand optimizer, and materials and cost estimates with tax.

The owner's existing SketchUp model is not imported; the house will be redrawn in this tool.

## Using the editor

- **Draw walls:** pick **Wall**, click where the wall starts, then type a length (`142`, `11' 10 3/8"`, `23-5/8`) and press Enter. The direction follows the mouse, snapping to 90 degrees; arrow keys set it, or type an angle (0 = right, 90 = up). Each wall starts where the last one ended. Click the first corner to close the room; Esc stops. Clicking places a wall to the pointer, rounded to the inch, and snaps to existing corners and walls.
- **Edit:** with **Select**, click a wall to change its length (walls joined at its far end follow), thickness or height. Drag a corner to move it. Delete removes the selection.
- **Doors, windows, openings:** pick the tool and click on a wall, then type the distance from the inside corner, width, height and sill. Problems (into a corner, overlapping, too tall) show in red.
- **Rooms** are found automatically; use **Room name** and click inside one to name it. Areas are inside the walls.
- **View:** drag empty space to pan, scroll or pinch to zoom, **Fit** to see everything. Undo and redo with the buttons or Ctrl+Z / Ctrl+Shift+Z. On a phone, switch between Plan and 3D at the top right.

## Start here

1. Read [`AGENTS.md`](AGENTS.md) for the rules every human and coding agent follows.
2. Follow [`docs/local-development.md`](docs/local-development.md) to clone the repository and create parallel worktrees.
3. Read [`docs/product-vision.md`](docs/product-vision.md), [`docs/requirements.md`](docs/requirements.md), and [`docs/architecture.md`](docs/architecture.md).
4. Track implementation in GitHub issues and consequential decisions in [`decisions/`](decisions/README.md).
5. Use the pull request template and leave final merging to the human owner.

## Repository map

| Location | Purpose |
| --- | --- |
| `AGENTS.md` | Shared instructions for all coding agents |
| `CLAUDE.md` | Thin Claude Code entry point |
| `.github/ISSUE_TEMPLATE/` | Feature, bug, and technical-debt issue forms |
| `.github/PULL_REQUEST_TEMPLATE.md` | Review and validation record |
| `.github/workflows/template-quality.yml` | Offline-safe scaffold validation in CI |
| `docs/` | Product, architecture, security, workflow, and local-development documentation |
| `decisions/` | Architecture Decision Records |
| `config/` | Standard labels and GitHub Project specification |
| `scripts/` | Local validation, export, and label setup |

## Validate locally

Use PowerShell 7:

```powershell
pwsh -File ./scripts/Test-Template.ps1
```

Application checks (Node.js 22 or newer):

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev     # local development server
```

## Current status

- Repository: private, owned by `benkoeslag`
- Development model: branch -> pull request -> review -> human merge
- Application stack: accepted, see [ADR-001](decisions/ADR-001-application-stack.md)
- License: undecided; see `LICENSE`
