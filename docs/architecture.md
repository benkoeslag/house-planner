# Architecture

Status: Draft. No application architecture has been accepted.

## Repository and collaboration architecture

GitHub is the durable shared source of truth. A clean `main` checkout is the owner's review copy. Each active agent uses a separate Git worktree and dedicated branch. Pull requests carry implementation, validation, and review history; only the human owner merges.

```text
main checkout (owner review)
        |
        +-- project-claude worktree -> Claude branch -> PR
        |
        +-- project-codex worktree  -> Codex branch  -> PR/review
```

## Application boundaries and components

Users, external systems, deployment boundary, trust boundaries, runtime, components, interfaces, and data ownership are `TBD`. The proposed direction is a single-user, client-only application with no accounts, server, or external services.

## Technology decisions

| Decision | Status | ADR |
| --- | --- | --- |
| Application runtime and framework | Proposed: browser application in TypeScript, built with Vite, with three.js for the 3D view; awaiting owner acceptance | Create when accepted |
| Persistence | Proposed: project files (JSON, inches) saved and opened locally, plus browser storage for autosave; no server or database | Create when accepted |
| Hosting and deployment | Proposed / `TBD` | Create before deployment work |

## Operations and risks

Local Git/VS Code operations are documented in `local-development.md`. Application configuration, environments, secrets, deployment, monitoring, backups, restore, and rollback remain `TBD`.
