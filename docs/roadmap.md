# Roadmap

Status: Draft. Dates require an explicit owner commitment. Milestones after M0 follow the order discussed with the owner on 2026-11-01 and need acceptance criteria confirmed before work starts.

| Milestone | Outcome | Exit criteria | Dependencies | Status |
| --- | --- | --- | --- | --- |
| M0: Foundation | Shared repository and review-first multi-agent workflow | Governance files migrated from `project-template`; CI passes; labels and `main` rules configured where supported; setup PR reviewed by owner | Repository access | Done |
| M1: Floor plan and 3D viewer | Draw the main floor and see it in 3D | Walls by typed measurements, doors, windows, rooms, dimensions, simple 3D view, save and open (FP-001 to FP-007 in `requirements.md`) | M0; stack accepted (ADR-001) | Done |
| M2: Cabinets on the plan | Plan cabinets on any wall using the prototype's engine | CAB-001 to CAB-006 in `requirements.md` (proposed); islands deferred | M1; ADR-003 accepted | In progress |
| M3: Wall items and clearances | Outlets, plumbing and vents on walls; door swing and clearance checks | `TBD` | M2 | Deferred |
| M4: Ceiling plan | Ceiling heights, bulkheads, lights and vents | `TBD` | M1 | Deferred |
| M5: Printing | Printable plans, elevations, cut lists and labels | `TBD` | M2 | Deferred |

## Current work

M1 is done, in five packages (#2 to #6).

M2, in seven packages:

1. Preserve the prototype, write the cabinet rules, propose ADR-003 and the M2 requirements. This is in progress.
2. Cabinet engine: parts, hardware and the cut list, with golden tests from the prototype.
3. Sheet layouts, the optimizer, consumables and costs.
4. Runs on walls, corners, layout and project file version 2.
5. Cabinet editing in the plan editor.
6. Cabinets in the 3D view.
7. Cut list, sheets and cost panels.

Each package starts only when the owner says so. Islands and peninsulas are deferred.

## Definition of done

A milestone is done when observable acceptance criteria are demonstrated, applicable checks pass, documentation is current, and known limitations are recorded. Agent approval never replaces the human merge decision.
