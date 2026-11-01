# Execution Plans

An execution plan is a live checklist for one task. It is kept on the task's branch and ticked off as the work happens. If a session ends partway through, any agent can read the plan and carry on from the next step without redoing finished work. A session can end without warning when it runs out of credits, hits a context limit, or the owner switches tools.

Agents cannot tell when a session is about to end. The only protection is to save progress often, so a lost session costs one step at most.

## When a plan is needed

Every task needs a plan except a small request (see [`AGENTS.md`](../../AGENTS.md#small-requests)). One work package is one task and one plan.

## Where it lives

- The path is `docs/execution/<task-id>-<short-slug>.md`. The task id is the issue number or the work-record id, for example `docs/execution/42-door-swing.md` or `docs/execution/BOOT-008-execution-plans.md`.
- The plan is committed on the task branch, so it travels with the work and never conflicts with other tasks.
- After the merge it stays in the repository as the record of how the task went.
- Start from [`PLAN-TEMPLATE.md`](PLAN-TEMPLATE.md).

## Starting a task

1. Check that no plan or draft PR already exists for the task. If one does, follow [Picking up a task](#picking-up-a-task) instead.
2. Create the branch and write the plan before changing anything else.
   - Break the work into numbered steps, each small enough to finish and push in about 15 minutes.
   - Write the "Next action".
3. Commit and push the plan.
4. Open a **draft** pull request that links to the plan.

## Keeping it current

- **When a step starts,** mark it `[~]`. **When it finishes,** mark it `[x]`, note the commit, and rewrite "Next action". Commit and push the plan together with the work.
- **Before anything long or risky,** push first. That means installs, long test runs, large refactors, or anything that might be interrupted.
- **Never leave more than about 15 minutes of work unpushed.** A work-in-progress commit is better than lost work.
- **Write down what saves repeat effort:**
  - decisions made while working
  - approaches that failed, and why
  - checks already run, with results
  - questions waiting on the owner
- **When the plan changes, edit the steps.** Mark dropped steps `[-]` instead of deleting them.
- **"Next action" must stand on its own.** Another agent should be able to start from that line alone, with file paths, commands and the exact point reached.

Plan-only commits are fine. Use a message like `plan: step 3 done`.

## Picking up a task

When the owner says to pick up a task:

1. Find the branch and the draft PR, then read the plan.
2. **Check the plan against reality:**
   - `git log` on the branch
   - the files the last steps touched
   - the project's checks
   A step marked `[x]` whose work is missing or broken goes back to `[ ]`. A step marked `[~]` may be half done, so check it before continuing.
3. Add a line to the handoff log: date, agent and model, and anything found out of date.
4. Continue from "Next action". Do not redo finished steps or re-read the whole history unless the check above calls for it.

## Finishing

1. Mark every step `[x]` or `[-]`, set the status to "Ready for review", and record the final checks.
2. Fill in the pull request description using the template, and mark the PR ready for review.
3. Leave the merge to the owner.
