# Requirements

Status: Draft. Governance requirements and the M1 floor plan requirements are confirmed.

## Current milestone

M0: Foundation — establish a private, review-first repository and a repeatable local workflow for parallel coding agents.

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

## Later application requirements

Cabinet planning, wall items and clearance checks, the ceiling plan, and printing are `TBD` until their milestones are defined. Reliability, performance, accessibility, and integrations are `TBD`.

Later milestones need their acceptance criteria confirmed before implementation starts.
