# Roadmap

Status: Draft. Dates require an explicit owner commitment. Milestones after M0 follow the order discussed with the owner on 2026-11-01 and need acceptance criteria confirmed before work starts.

| Milestone | Outcome | Exit criteria | Dependencies | Status |
| --- | --- | --- | --- | --- |
| M0: Foundation | Shared repository and review-first multi-agent workflow | Governance files migrated from `project-template`; CI passes; labels and `main` rules configured where supported; setup PR reviewed by owner | Repository access | In progress |
| M1: Floor plan and 3D viewer | Draw the main floor and see it in 3D | Walls by typed measurements, doors, windows, rooms, dimensions, simple 3D view, save and open (FP-001 to FP-007 in `requirements.md`) | M0; stack accepted (ADR-001) | In progress |
| M2: Cabinets on the plan | Plan cabinets on any wall using the prototype's engine | `TBD` | M1 | Planned |
| M3: Wall items and clearances | Outlets, plumbing and vents on walls; door swing and clearance checks | `TBD` | M2 | Deferred |
| M4: Ceiling plan | Ceiling heights, bulkheads, lights and vents | `TBD` | M1 | Deferred |
| M5: Printing | Printable plans, elevations, cut lists and labels | `TBD` | M2 | Deferred |

## Current work

M1, in five packages: (1) project skeleton and stack decision (done), (2) plan data model and geometry (done), (3) simple 3D viewer (in progress), (4) floor plan editor, (5) save, open and autosave.

## Definition of done

A milestone is done when observable acceptance criteria are demonstrated, applicable checks pass, documentation is current, and known limitations are recorded. Agent approval never replaces the human merge decision.
