# Contributing

Read and follow `AGENTS.md` before making changes.

1. Open or select an issue with a clear problem, scope, and acceptance criteria when practical.
2. Update the local `main` checkout without changing it.
3. Create a dedicated branch or worktree such as `feature/123-short-description`, `agent/claude/description`, or `agent/codex/description`.
4. Implement the smallest complete change and run applicable checks.
5. Update requirements, operational documentation, and ADRs when needed.
6. Push the branch and open or update a pull request using the repository template.
7. Have a human or another agent review the PR and address review comments on the same branch.
8. Leave the final merge decision to the human repository owner.

Never commit credentials, tokens, `.env` secrets, or private customer or production data. Never push directly to `main`, bypass protections, or merge a pull request as an agent.

See `docs/local-development.md` for the recommended Windows/PowerShell worktree workflow.
