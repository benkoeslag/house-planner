# Requirements

Status: Draft. Governance requirements and the M1 floor plan requirements are confirmed. The M2 cabinet requirements are proposed and need the owner's acceptance.

## Current milestone

M2: Cabinets on the plan — carry the cabinet planner prototype into House Planner and plan cabinets on any wall of the floor plan. M0 and M1 are done.

## Confirmed workflow requirements

| ID | Actor | Required behavior | Acceptance criteria | Milestone |
| --- | --- | --- | --- | --- |
| WF-001 | Coding agent | Work on a dedicated non-`main` branch | No agent-authored task commits are pushed directly to `main` | M0 |
| WF-002 | Coding agent | Push work and create or update a PR | PR explains purpose, changes, validation, risks, and remaining work | M0 |
| WF-003 | Reviewing agent | Review another agent's PR and leave actionable comments | Review comments are visible on the PR and can be addressed with follow-up commits | M0 |
| WF-004 | Human owner | Retain the final merge decision | Agent instructions prohibit merges and repository rules require PRs where supported | M0 |
| WF-005 | All contributors | Keep secrets and private production data out of Git | Ignore rules, instructions, and review checklist state the restriction | M0 |
| WF-006 | Developer | Run Claude Code and Codex in parallel worktrees | Exact Windows/PowerShell commands are documented | M0 |

## M1 requirements: floor plan and 3D viewer

From the owner's 2026-11-01 planning conversation; accepted by the owner in chat on 2026-11-01.

| ID | Actor | Required behavior | Acceptance criteria | Milestone |
| --- | --- | --- | --- | --- |
| FP-001 | Owner | Draw walls by typed measurements | Click a start point, type a length, and a wall of that length is drawn; turns snap to 90 degrees; odd angles can be typed | M1 |
| FP-002 | Owner | Set wall properties | Each wall has its own thickness and height, editable after drawing; walls can be deleted | M1 |
| FP-003 | Owner | Place doors and windows | An opening is placed on a wall by distance from the corner, width, height, and sill height; doors show their swing on the plan | M1 |
| FP-004 | Owner | Identify rooms | Enclosed areas are detected and can be named | M1 |
| FP-005 | Owner | Read dimensions | Every wall shows its length on the plan | M1 |
| FP-006 | Owner | See the plan in 3D | A simple 3D view shows walls with door and window openings and a floor, can be orbited, panned and zoomed, and updates as the plan changes | M1 |
| FP-007 | Owner | Keep the work | A project can be saved to and opened from a file; work is also kept automatically in the browser | M1 |

## M2 requirements: cabinets on the plan (proposed)

From the owner's 2026-11-01 direction to preserve the prototype first, defer islands, and carry everything over. Proposed for the owner's acceptance. The rules behind every number are in [`cabinet-rules.md`](cabinet-rules.md). The placement model and file format are proposed in [ADR-003](../decisions/ADR-003-cabinet-runs-and-file-v2.md).

The acceptance tests use the **starter kitchen**: the prototype's example cabinet list, which follows the owner's SketchUp layout. Its walls are 156″ and 128″ from the inside corner, with the stove 56″ from the corner and the window 69 5/8″ from the corner.

| ID | Actor | Required behavior | Acceptance criteria | Milestone |
| --- | --- | --- | --- | --- |
| CAB-001 | Owner | Plan cabinets on any wall | Choose a wall face on the plan and add every prototype cabinet type to its base or upper row. Fixed positions, snapping, line-up, the single leftover gap and every layout warning behave as in `cabinet-rules.md`. Windows and doors on the plan block the rows they cross. | M2 |
| CAB-002 | Owner | Plan the corners | Inside corners between runs are found automatically. The owner picks which run owns the corner and the base and upper corner style (open, blind, diagonal upper). The starter kitchen's rows start where the prototype's do (left wall bases at 0, right wall bases at 27 19/32″, uppers at 24″). | M2 |
| CAB-003 | Owner | Get the cut list and sheet layouts | The cut list is grouped and numbered as in the prototype, with per-part and "hidden parts" grain choices. Quick sheet layouts show at once. The optimizer runs only on request and gives readable cut steps. For the starter kitchen the parts match the prototype exactly, and the quick layout uses 11, 4 and 2 sheets. | M2 |
| CAB-004 | Owner | See materials and cost | Hardware, consumables, countertop and toe kick lengths are listed with their basis. Every price is editable to the cent, and each line shows subtotal, tax and total. With default prices the starter kitchen totals $2,812.80 before tax and $3,178.46 with 13% tax. | M2 |
| CAB-005 | Owner | See cabinets in 3D | Boxes, doors, drawer fronts, countertops and toe kicks show on their walls in the 3D view and update as cabinets change. | M2 |
| CAB-006 | Owner | Keep cabinet work | Cabinets, corner choices, cabinet settings, prices, grain choices and the accepted optimized layout are saved in the project file (version 2) and in autosave. Version 1 files still open. Cabinet changes can be undone. | M2 |

## Later application requirements

Wall items and clearance checks, the ceiling plan, and printing are `TBD` until their milestones are defined. Reliability, performance, accessibility, and integrations are `TBD`.

Later milestones need their acceptance criteria confirmed before implementation starts.
