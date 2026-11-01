# Project Setup

## Completed foundation

- Private repository `benkoeslag/house-planner` created empty, then the files from `benkoeslag/project-template` migrated in (all paths in `template.manifest.json`).
- README, product vision, requirements, and roadmap adapted to the house planner direction the owner stated on 2026-11-01.
- Owner accepted the M1 requirements and the application stack on 2026-11-01 (ADR-001).
- Application skeleton: Vite, TypeScript, three.js, Vitest, and `app-ci.yml` (M1 package 1).
- Shared agent instructions adapted for Claude Code, Codex, and future agents.
- Review-first branch and PR rules documented.
- PR and issue templates, ADRs, label configuration, and scaffold CI retained and adapted.
- Windows/PowerShell worktree workflow documented.

## Remaining owner decisions

- Decide the license before distribution.
- Define supported versions and a private vulnerability contact.
- Add lint and any further application-specific checks as the code grows (type check, tests, and build run in `app-ci.yml`).
- Create the standard labels with `scripts/Initialize-GitHubLabels.ps1` and configure the `main` rules described in `github-workflow.md`.
- Create a GitHub Project from `config/github-project.json` if the project benefits from a board.

Do not treat example commands or `TBD` sections as approved product decisions.
