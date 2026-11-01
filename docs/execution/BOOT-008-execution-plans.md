# Execution plan: BOOT-008 Execution plans as a failsafe for handoffs

| | |
| --- | --- |
| Task | Owner request, 2026-11-01: keep a running execution plan, crossed off as work happens, so another agent can pick up where a session that ran out of credits left off. Add it to the governance here and in `project-template`. Work record BOOT-008. |
| Branch | `agent/claude/execution-plans`. It starts from `agent/claude/m2-prototype-spec` (#7) to avoid a work-record conflict, so merge #7 first. |
| Pull requests | house-planner: #8 (draft). project-template: [#5](https://github.com/benkoeslag/project-template/pull/5). |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | In progress |

## Goal and done-when

Every task that isn't a small request has a plan file on its branch. The file is pushed often, and any agent can resume from its "Next action". This is done when:

- The rule, the plan template and the pickup steps are in `project-template`, and the same rules are in `house-planner` with its project section kept.
- Both repositories pass their checks.
- Both PRs are open for the owner.

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR in house-planner (#8)
2. [x] project-template: add `docs/execution/README.md` (the protocol) and `docs/execution/PLAN-TEMPLATE.md` (project-template `3e19f39`)
3. [x] project-template: AGENTS.md (before working, Git rules, the new section, completion), the PR template, `docs/github-workflow.md`, the manifest, README (`bcc31dc`)
4. [x] project-template: run the checks (Python copy of Test-Template), commit, push, open the PR (#5)
5. [x] house-planner: bring over the same files and rules, then update the work record (BOOT-008) and the review queue
6. [x] house-planner: run the checks (template check, typecheck, tests, build), commit and push
7. [~] Mark both PRs ready, finish this plan, and report to the owner

## Next action

Step 7:

1. Fill in the PR description for house-planner #8 and mark it ready for review. project-template #5 is already open and ready.
2. Set this plan's status to "Ready for review".
3. Report to the owner, including that #7 must merge before #8.

## Decisions made while working

- Plan files live at `docs/execution/<task-id>-<slug>.md` on the task branch, so nothing outside the PR changes and parallel tasks never touch the same file. They stay in the repository after merge as the record.
- Open a draft PR as soon as the plan is pushed, and mark it ready at the end. This replaces "open the PR when done".
- Small requests don't need a plan file.
- Template drift from `fish-sticks` (review queue R-012) is left alone. Only this section is added.

## Tried and did not work

- `pwsh` is not available here, and downloading it was blocked earlier in the session. Template checks are replicated in Python, and the owner is asked to run the real script once.

## Checks run

- project-template: the Python copy of Test-Template passed: 40 manifest files, JSON, and relative links including the new anchors.
- house-planner: the Python copy of Test-Template passed (40 manifest files, and every relative link in the repository resolves). `npm run typecheck` passed, `npm test` passed 135 tests, and `npm run build` passed.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
