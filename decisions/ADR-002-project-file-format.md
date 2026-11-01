# ADR-002: Project file format, version 1

- Status: Accepted
- Date: 2026-11-01
- Decision maker: Repository owner (`benkoeslag`), within the M1 package 2 scope the owner approved on 2026-11-01; confirmed by merging the package pull request
- Issue / PR: M1 package 2 (see `docs/roadmap.md`)
- Supersedes / superseded by: None

## Context

ADR-001 chose local JSON project files with no server. The file is the owner's only durable copy of their house plan, so it must stay readable as the app grows (cabinets, ceiling plan, more floors) and must never silently lose data.

## Options considered

| Option | Benefits | Costs and limitations |
| --- | --- | --- |
| JSON with a format tag, a version number, and step-by-step migrations | Readable, diffable, easy to back up; old files keep opening | Each format change needs a migration and a test |
| JSON without versioning | Simplest now | No safe way to change the shape later |
| Binary or database file (for example SQLite) | Compact, queryable | Overkill for one plan; harder to inspect and diff |

## Decision

Save projects as pretty-printed JSON:

```json
{ "format": "house-planner", "version": 1, "units": "in", "name": "...", "settings": { ... }, "plan": { "walls": [], "openings": [], "roomLabels": [] } }
```

Walls are stored as centerlines with thickness and height; openings reference their wall by id with an offset along the centerline; rooms are not stored but derived from the walls. All lengths are decimal inches. Details are in `docs/data-model.md`.

## Consequences

- Reading validates every value and reports problems in plain language with the value's location; it never throws.
- Files from a newer version are refused rather than partly read, so no data is dropped by an older app.
- Every future change to the saved shape bumps the version, adds a migration from the previous version, and adds a test that opens an old-format file. `AGENTS.md` already lists the project file format as a high-risk area.

## Validation and references

- `tests/project-file.test.ts`: exact round trip, rejection of non-project files, newer versions, bad values, dangling references and repeated ids, and the migration mechanism (tested with a made-up version 0, since no older format exists).
