# Project Setup

## Completed foundation

- Private repository `benkoeslag/house-planner` created empty, then the files from `benkoeslag/project-template` migrated in (all paths in `template.manifest.json`).
- README, product vision, requirements, and roadmap adapted to the house planner direction the owner stated on 2026-11-01.
- Shared agent instructions adapted for Claude Code, Codex, and future agents.
- Review-first branch and PR rules documented.
- PR and issue templates, ADRs, label configuration, and scaffold CI retained and adapted.
- Windows/PowerShell worktree workflow documented.

## Remaining owner decisions

- Confirm the proposed M1 acceptance criteria in `requirements.md`.
- Accept or change the proposed application stack in `architecture.md`.
- Decide the license before distribution.
- Define supported versions and a private vulnerability contact.
- Add application-specific build, test, lint, dependency, and security checks.
- Create the standard labels with `scripts/Initialize-GitHubLabels.ps1` and configure the `main` rules described in `github-workflow.md`.
- Create a GitHub Project from `config/github-project.json` if the project benefits from a board.

Do not treat example commands or `TBD` sections as approved product decisions.
