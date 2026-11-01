# Bootstrap Work Record

Use this record for explicitly requested setup work before a GitHub issue exists. Move ongoing implementation work to GitHub issues once the project scope is defined.

| ID | Owner request | Scope | Status | GitHub issue |
| --- | --- | --- | --- | --- |
| BOOT-001 | Migrate the governance files from `benkoeslag/project-template` into the new `house-planner` repository and add a README | Template files from `template.manifest.json`, project README, product vision and roadmap from the owner's stated direction, house-planner worktree paths | Done | [#1](https://github.com/benkoeslag/house-planner/pull/1) |
| BOOT-002 | Start M1 with package 1: project skeleton and stack decision (owner accepted the stack and M1 requirements and asked to start package 1 on 2026-11-01) | Vite, TypeScript, three.js, Vitest, CI workflow, ADR-001, documentation updates | Done | [#2](https://github.com/benkoeslag/house-planner/pull/2) |
| BOOT-003 | M1 package 2: plan data model and geometry (owner asked to start it on 2026-11-01) | Plan types, wall corners and faces, room detection, opening checks, length formatting and parsing, plan operations, project file version 1, ADR-002, data model docs | Done | [#3](https://github.com/benkoeslag/house-planner/pull/3) |
| BOOT-004 | M1 package 3: simple 3D viewer (owner asked to start it on 2026-11-01) | Wall pieces cut around openings, three.js plan view with orbit controls, sample room on screen, tests | Done | [#4](https://github.com/benkoeslag/house-planner/pull/4) |
| BOOT-005 | M1 package 4: floor plan editor (owner asked to start it on 2026-11-01) | Wall drawing by typed lengths and the mouse, editing, corner dragging, doors, windows, openings, room names, dimensions, undo, side-by-side 3D, phone layout | Done | [#5](https://github.com/benkoeslag/house-planner/pull/5) |
| BOOT-006 | M1 package 5: save, open and autosave (owner asked to start it on 2026-11-01) | Save file, open file, browser autosave with restore, project name, undoable open, storage tests | Done | [#6](https://github.com/benkoeslag/house-planner/pull/6) |
| BOOT-007 | M2 package 1: preserve the prototype first, defer islands, carry everything over (owner on 2026-11-01) | Prototype copied unchanged to `docs/prototype/`, every prototype rule written out with worked examples in `docs/cabinet-rules.md`, ADR-003 (proposed), M2 requirements CAB-001 to CAB-006 (proposed), roadmap | In progress | Bootstrap request; PR to be linked |

Do not copy another project's work history or application decisions into this repository.
