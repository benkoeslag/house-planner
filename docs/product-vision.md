# Product Vision

Status: Draft. The direction below was stated by the owner in a planning conversation on 2026-11-01; details marked `TBD` are not yet decided.

## Product definition

A personal tool for planning the owner's house. The owner draws the main floor as a floor plan, sees it in a simple 3D view, and plans built-in cabinetry against the real walls. The tool then produces what is needed to build it: cut lists, sheet layouts, materials, and cost estimates.

## Confirmed context

- The repository is privately owned by `benkoeslag`.
- Development will happen locally in VS Code and in Claude Code cloud sessions.
- Claude Code, OpenAI Codex, and potentially other agents will collaborate through GitHub.
- The human owner retains the final merge decision.
- The owner builds the cabinets personally: frameless boxes in 3/4" maple plywood, pocket screws and glue, 1/4" backs, a separate leveled 2x4 platform base with an applied toe kick, and full-overlay slab doors with black pulls.
- A working single-file cabinet planner prototype was built during planning. Its features and construction rules are the starting point for cabinet planning in this tool.

## Owner decisions so far

| Decision | Source |
| --- | --- |
| Plan the house as a floor plan editor, with a ceiling plan possibly later | Owner, 2026-11-01 |
| A simple 3D viewer is needed from the start | Owner, 2026-11-01 |
| Redraw the house in this tool instead of importing the existing SketchUp model (the owner has SketchUp's web version only, and considers the current drawing unsuitable) | Owner, 2026-11-01 |
| The scope is the main floor; the wood shop is excluded | Owner, 2026-11-01 |

## Problem and users

- Product problem: planning cabinetry and built-ins against a real, measured house, and turning the plan into accurate cutting and buying lists.
- Primary user: the owner.
- Buyer or operator: the owner.

## Value and boundaries

- Desired product outcome: an accurate plan the owner can build from, with numbers trusted enough to cut maple plywood from.
- Initial product scope: floor plan editor and simple 3D viewer (see `roadmap.md`).
- Non-goals: replacing a general 3D modeling tool such as SketchUp; importing the existing SketchUp model.
- Business model: none; personal use.

## Success measures

| Measure | Baseline | Target | How measured |
| --- | --- | --- | --- |
| Floor plan accuracy | No plan in the tool | The main floor drawn from measurements, viewable in 3D | Owner review |
| Cabinet output | Prototype for two kitchen walls | Cut lists and sheet layouts for cabinets on any wall | Owner review against built cabinets |
| Development governance | Template migrated | Review-first multi-agent workflow documented and enforced where supported | Repository review |

## Open questions

- Ceiling plan contents and timing: `TBD`.
- Whether house plans or blueprints exist to trace, or the house is measured from scratch: `TBD`.
- Printing and PDF output requirements: `TBD`.
- Browser-only or an installed desktop app later: `TBD`.
