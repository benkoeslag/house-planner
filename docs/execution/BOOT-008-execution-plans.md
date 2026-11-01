# Execution plan: BOOT-008 Execution plans as a failsafe for handoffs

| | |
| --- | --- |
| Task | Owner request, 2026-11-01: keep a running execution plan, crossed off as work happens, so another agent can pick up where a session that ran out of credits left off. Add it to the governance here and in `project-template`. Work record BOOT-008. |
| Branch | `agent/claude/execution-plans`. It starts from `agent/claude/m2-prototype-spec` (#7) to avoid a work-record conflict, so merge #7 first. |
| Pull requests | house-planner: draft, to be linked. project-template: to be linked. |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | In progress |

## Goal and done-when

Every task that isn't a small request has a plan file on its branch. The file is pushed often, and any agent can resume from its "Next action". This is done when:

- The rule, the plan template and the pickup steps are in `project-template`, and the same rules are in `house-planner` with its project section kept.
- Both repositories pass their checks.
- Both PRs are open for the owner.

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR in house-planner
2. [ ] project-template: add `docs/execution/README.md` (the protocol) and `docs/execution/PLAN-TEMPLATE.md`
3. [ ] project-template: AGENTS.md (before working, Git rules, the new section, completion), the PR template, `docs/github-workflow.md`, the manifest, README
4. [ ] project-template: run the checks (Python copy of Test-Template), commit, push, open the PR
5. [ ] house-planner: bring over the same files and rules, then update the work record (BOOT-008) and the review queue
6. [ ] house-planner: run the checks (template check, typecheck, tests, build), commit and push
7. [ ] Mark both PRs ready, finish this plan, and report to the owner

## Next action

Step 2: write `docs/execution/README.md` and `docs/execution/PLAN-TEMPLATE.md` in `/home/user/project-template`, on a new branch `agent/claude/execution-plans` from `origin/main`.

## Decisions made while working

- Plan files live at `docs/execution/<task-id>-<slug>.md` on the task branch, so nothing outside the PR changes and parallel tasks never touch the same file. They stay in the repository after merge as the record.
- Open a draft PR as soon as the plan is pushed, and mark it ready at the end. This replaces "open the PR when done".
- Small requests don't need a plan file.
- Template drift from `fish-sticks` (review queue R-012) is left alone. Only this section is added.

## Tried and did not work

None yet.

## Checks run

None yet.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
