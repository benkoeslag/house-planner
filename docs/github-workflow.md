# GitHub Workflow

GitHub is the durable source of truth. Issues hold executable work, pull requests hold proposed changes and reviews, Actions hold automated validation, and ADRs preserve consequential decisions.

## Standard statuses

| Status | Entry condition | Exit condition |
| --- | --- | --- |
| Backlog | An idea or task is captured | Scope and dependencies are understood |
| Ready | Acceptance criteria are clear and blockers resolved | An owner begins implementation |
| In Progress | Work has an active branch and owner | A reviewable change is ready |
| Review | A PR is ready | Material review comments are addressed |
| Testing | Final acceptance or integration checks remain | Checks pass and evidence is recorded |
| Done | The human owner merged the PR and completion is documented | Reopen if a material defect invalidates completion |

For small changes, Review and Testing may happen together. Never close work merely to make the board look complete.

## Branch and PR lifecycle

1. Create or select an issue where practical.
2. Update the local `main` review checkout.
3. Create a dedicated branch/worktree.
4. Write the execution plan (`docs/execution/`), push it, and open a draft PR. Small requests skip the plan.
5. Implement in small steps. Tick off the plan and push after each one, so another agent can take over at any point.
6. Run applicable checks, complete the plan, fill in the PR description, and mark the PR ready for review.
7. A different agent or the human owner reviews and leaves comments.
8. The implementing agent responds and pushes follow-up commits.
9. CI passes and conversations are resolved.
10. Only the human repository owner decides whether to merge.

Agents never push to `main`, merge PRs, bypass protections, or delete protected branches.

## Handoffs between agents

When a session ends partway through a task, start the next agent with "pick up" and the task's issue, branch, or draft PR. The agent reads the task's execution plan, checks it against the branch, and continues from its "Next action". See [`execution/README.md`](execution/README.md).

## Labels and Project fields

`config/github-labels.json` defines standard priority, type, area, agent, and review labels. `config/github-project.json` is a setup specification, not an automatically imported file.

Use one priority and one primary type per issue. Multiple area labels may be useful. Agent labels describe primary implementation or review involvement; they do not grant authority.

## Repository rules

Configure `main` to require a pull request, block force pushes and deletion, require conversations to be resolved, and require `Validate project scaffold` after it has completed successfully. Preserve an owner path to merge approved work. Plan limitations that prevent enforcement must be documented rather than worked around.

## Work packages and model recommendations

Issues that hold more than a small change are split into packages, each with its own scope, acceptance criteria, delivery contract, and a model recommendation for Claude and ChatGPT/Codex. High-risk packages also name a recommended higher-model review, which the agent suggests in chat after the package is complete. The rules, the small-request test, and the recommendation format are in [`AGENTS.md`](../AGENTS.md#work-packages-and-model-recommendations); current models and effort levels are in [`model-roster.md`](model-roster.md).
