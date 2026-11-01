# House Planner

A planning tool for the owner's house: draw the main floor as a floor plan, see it in a simple 3D view, and plan built-in cabinetry against the real walls, then produce cut lists, sheet layouts and cost estimates for building it.

The project is developed by the owner and multiple coding agents, primarily Claude Code and OpenAI Codex. GitHub is the shared source of truth, and all substantive changes flow through reviewable pull requests that only the owner merges.

## Status

Milestone M0 (foundation) is done: the governance and workflow from [`benkoeslag/project-template`](https://github.com/benkoeslag/project-template) are in place. Milestone M1 (floor plan editor and 3D viewer) is in progress; the app currently shows an empty 3D scene.

What the owner has decided so far is recorded in [`docs/product-vision.md`](docs/product-vision.md) and [`docs/roadmap.md`](docs/roadmap.md). The application stack is a TypeScript browser app (Vite, three.js, Vitest); see [`docs/architecture.md`](docs/architecture.md).

## Planned scope

- **Floor plan editor** for the main floor: walls drawn by typed measurements, doors, windows, rooms and dimensions. A ceiling plan may follow.
- **Simple 3D viewer** generated from the floor plan, needed from the first milestone.
- **Cabinet planning on any wall**, carrying over a working prototype built during planning: frameless 3/4" maple plywood boxes, fixed pieces, snapping, gables, blind and diagonal corners, cut lists, sheet layouts with an on-demand optimizer, and materials and cost estimates with tax.

The owner's existing SketchUp model is not imported; the house will be redrawn in this tool.

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
