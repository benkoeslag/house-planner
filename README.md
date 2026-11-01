# House Planner

A planning tool for the owner's house: draw the main floor as a floor plan, see it in a simple 3D view, and plan built-in cabinetry against the real walls, then produce cut lists, sheet layouts and cost estimates for building it.

The project is developed by the owner and multiple coding agents, primarily Claude Code and OpenAI Codex. GitHub is the shared source of truth, and all substantive changes flow through reviewable pull requests that only the owner merges.

## Status

Milestones M0 (foundation) and M1 (floor plan editor and 3D viewer) are done. The app has the floor plan editor next to the 3D view, with file save and open and automatic saving in the browser.

Milestone M2 (cabinets on the plan) has started. The cabinet planner prototype is kept unchanged in [`docs/prototype/`](docs/prototype/README.md). All of its rules are written out in [`docs/cabinet-rules.md`](docs/cabinet-rules.md), and [ADR-003](decisions/ADR-003-cabinet-runs-and-file-v2.md) proposes how cabinets will sit on the plan's walls.

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
- **Saving:** the plan is autosaved in this browser a moment after every change and restored when you come back. **Save file** downloads a `.house-planner.json` file named after the project; keep these as your real backups. **Open file** loads one; if the file is damaged or from a newer version, you get a plain message and nothing changes. Opening a file can be undone.
- **Cabinets:**
  - Pick **Cabinets** (C), then click a wall, or the floor just in front of it, to start a cabinet run on that face. Positions are measured from the corner shown in blue; **Measure from the other end** flips it.
  - Add cabinets to the **Base row** or **Upper row**. New ones go at the end; move them with the arrows. Type widths and sizes as lengths (`23 7/8`, `2' 6"`).
  - Open a cabinet to set its details, its position (in list order, centered on a window or door, at a distance, lined up with a base cabinet, or right after the fixed piece above) and which way it pulls.
  - Where two runs meet at a corner, choose whose cabinets go into it, and add a diagonal corner upper if you want one.
  - Problems (overlaps, gaps, running past the wall) show in red on the plan and in the panel. Deleting a wall removes the cabinets on it; undo brings them back.
- **View:** drag empty space to pan, scroll or pinch to zoom, **Fit** to see everything. Undo and redo with the buttons or Ctrl+Z / Ctrl+Shift+Z. On a phone, switch between Plan and 3D at the top right.

## Start here

1. Read [`AGENTS.md`](AGENTS.md) for the rules every human and coding agent follows.
2. Follow [`docs/local-development.md`](docs/local-development.md) to clone the repository and create parallel worktrees.
3. Read [`docs/product-vision.md`](docs/product-vision.md), [`docs/requirements.md`](docs/requirements.md), and [`docs/architecture.md`](docs/architecture.md).
4. Track implementation in GitHub issues and consequential decisions in [`decisions/`](decisions/README.md).
5. Check [`docs/review-queue.md`](docs/review-queue.md) for work still waiting for an independent review and for owner decisions.
6. Use the pull request template and leave final merging to the human owner.

## Repository map

| Location | Purpose |
| --- | --- |
| `AGENTS.md` | Shared instructions for all coding agents |
| `CLAUDE.md` | Thin Claude Code entry point |
| `.github/ISSUE_TEMPLATE/` | Feature, bug, and technical-debt issue forms |
| `.github/PULL_REQUEST_TEMPLATE.md` | Review and validation record |
| `.github/workflows/template-quality.yml` | Offline-safe scaffold validation in CI |
| `docs/` | Product, architecture, security, workflow, and local-development documentation |
| `docs/execution/` | Live execution plans, so any agent can pick up a task where the last one stopped |
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
