# Local Development with VS Code and Parallel Agents

These commands use Windows PowerShell. Install Git, VS Code, Claude Code, and Codex through their official instructions, then authenticate each tool to the services it needs. Never paste credentials into repository files.

## Clone and open the human review copy

```powershell
Set-Location C:\Projects
git clone https://github.com/benkoeslag/house-planner.git house-planner
Set-Location .\house-planner
code .
```

Keep this checkout on `main` as the owner's clean review copy. Do not run an agent on `main`.

## Create parallel worktrees

From `C:\Projects\house-planner`:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main

git worktree add -b agent/claude/current-task ..\house-planner-claude origin/main
git worktree add -b agent/codex/current-task ..\house-planner-codex origin/main

code -n ..\house-planner-claude
code -n ..\house-planner-codex
```

Replace `current-task` with a short description or use an issue branch such as `feature/123-description`.

Expected layout:

```text
C:\Projects\house-planner\        # main checkout; human review copy
C:\Projects\house-planner-claude\ # Claude branch/worktree
C:\Projects\house-planner-codex\  # Codex branch/worktree
```

## Start the agents

In the VS Code terminal for `house-planner-claude`:

```powershell
Set-Location C:\Projects\house-planner-claude
claude
```

In the VS Code terminal for `house-planner-codex`:

```powershell
Set-Location C:\Projects\house-planner-codex
codex
```

Each agent must read `AGENTS.md`, stay on its dedicated branch, and push a PR rather than merge.

## List and update worktrees

```powershell
Set-Location C:\Projects\house-planner
git worktree list

git fetch origin
git -C ..\house-planner-claude rebase origin/main
git -C ..\house-planner-codex rebase origin/main
```

Rebase only a task branch you own and only when doing so will not disrupt another contributor. If the branch is already shared, prefer merging `origin/main` into it unless the team agrees otherwise.

## Push and open a PR

From an agent worktree:

```powershell
git status
git add --all
git commit -m "Describe the focused change"
git push -u origin HEAD
```

Create the PR on GitHub, complete the repository template, and request review from the human owner or another agent. Agents do not merge.

## Remove completed worktrees

After the human owner merges the PR and the worktree has no uncommitted changes:

```powershell
Set-Location C:\Projects\house-planner
git fetch origin --prune
git switch main
git pull --ff-only origin main

git worktree remove ..\house-planner-claude
git worktree remove ..\house-planner-codex
git worktree prune

git branch -d agent/claude/current-task
git branch -d agent/codex/current-task
```

Deleting remote task branches is optional and must never target `main` or another protected branch.
