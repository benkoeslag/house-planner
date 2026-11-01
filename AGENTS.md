# Project Agent Instructions

## Source of truth

GitHub is the shared source of truth for humans, Claude Code, Codex, and other coding agents. Repository documentation, accepted ADRs, issues, pull requests, and code are the durable project record. Chat history is supporting context only.

Distinguish implemented behavior, accepted decisions, proposals, and unknowns. Mark genuine unknowns as `TBD`; do not invent product decisions.

## Before working

1. Read `README.md`, `docs/product-vision.md`, and `docs/architecture.md`.
2. Read relevant requirements, security rules, permissions, and accepted ADRs.
3. Review the associated GitHub issue and its acceptance criteria when one exists.
4. Inspect current files and preserve unrelated work.
5. Confirm that the current branch is a dedicated task branch, never `main`.

## Git and GitHub rules

- Never work directly on `main`.
- Never push directly to `main`.
- Never force-push `main`.
- Never merge a pull request.
- Never bypass branch protections or rulesets.
- Never delete protected branches.
- Work on a dedicated branch for each task.
- Link substantive work to a GitHub issue where practical. During bootstrap, record an explicit owner request in `docs/work-record.md` and reconcile it with GitHub later if useful.
- Run applicable tests, build, lint, and documentation checks before considering work complete.
- Push completed work and create or update a pull request.
- In the PR, explain what changed, why, validation performed, risks, and remaining work.
- Agents may review other agents' pull requests and leave inline or general review comments.
- Agents may respond to review comments and push follow-up commits to their own task branch.
- Only the human repository owner makes the final merge decision.

Use focused branch names such as:

- `feature/123-description`
- `fix/123-description`
- `agent/claude/description`
- `agent/codex/description`
- `setup/description`

Do not reuse a branch for unrelated work. Do not rewrite another agent's branch history unless the owner explicitly requests it.

## Scope and implementation

- Complete authorized work without repeatedly asking about routine implementation choices.
- Clarify product decisions that cannot be inferred. Do useful independent work while waiting.
- Do not create remote resources, publish, deploy, or contact others solely because an example command appears in documentation. Follow the human's requested scope.
- Prefer the simplest design that meets current acceptance criteria. Defer features outside the current milestone.
- Document consequential technical choices in an ADR. Mark proposals as proposed until the decision maker accepts them.
- Add appropriate automated checks for behavior changes, especially security, authorization, administrative actions, and failure handling.
- Update documentation when behavior, operations, or architecture changes.

## Work packages and model recommendations

These rules apply to every agent, whether it is writing a plan into a GitHub issue or receiving a prompt directly in VS Code or a terminal. The owner chooses the model and decides when each package runs.

### Small requests

A request is small only when all of these are true:

1. It is one concern: a single fix or tweak with nothing to split into packages.
2. The intent is clear: no design or product decision and nothing ambiguous to ask about.
3. The footprint is small: about 3 files and 50 changed lines or fewer, excluding tests.
4. It touches no high-risk area: security or permissions, saved user data, networking, CI and workflows, dependencies, governance documents (`AGENTS.md`, `docs/model-roster.md`, issue and PR templates), or any area the project section of this file adds.
5. It would not warrant a higher-model review.

For a small request, say "Small request — executing directly." and proceed without packaging or a model recommendation. Branch, check, and pull request rules still apply. If the work grows past the line partway through, stop, report what is done, and give the full package breakdown for the rest. When unsure, treat the request as not small.

### Everything else

1. **Assess the request.** Review scope, risks, ambiguity, and dependencies on existing code and documentation before acting.
2. **Break it into packages.** Each package is self-contained, with its own scope, acceptance criteria, and delivery contract (a dedicated branch and pull request).
3. **Recommend a model for every package.** Give an exact model and effort level for both Claude and ChatGPT/Codex, taken from [`docs/model-roster.md`](docs/model-roster.md), with one line on why that tier fits.
4. **Order packages with the model in mind.** When the work spans many packages or issues, regroup or reorder them so consecutive packages share a model tier where that saves effort. Dependency order always wins, and any reordering is stated with its reason.
5. **Flag reviews for major changes.** For high-risk packages (architecture, security or permissions, saved data, networking, large refactors, new core systems), recommend a higher-model review: the reviewer model and effort for Claude and ChatGPT/Codex from the roster's Reviewer tier, and what the review should challenge or try to refute.
6. **Stop and hand off.** Present the packages and recommendations, then wait. Do not start a package until the owner asks for it; the owner typically runs one package at a time.
7. **Prompt for the review after the package.** When a package that carries a review recommendation is complete, end the chat handoff with the recommended reviewer models, the pull request or branch to review, and what to challenge. Remind the owner to test first and then decide whether to run the review now, later, or not at all. Never start the review or switch models yourself.

Write each package's recommendation in this form:

```markdown
**Model recommendation**
- Claude: Sonnet 5.5 · medium
- ChatGPT/Codex: <model> · <effort>
- Why: <one line>
- Review after completion: Claude <model> · <effort>; ChatGPT/Codex <model> · <effort>. Challenge: <what to refute>
```

Omit the review line when no review is recommended.

### Keeping the roster current

Each vendor's agents maintain their own vendor's column in [`docs/model-roster.md`](docs/model-roster.md): Claude agents the Claude column, ChatGPT/Codex agents the ChatGPT/Codex column. Before recommending models, check your own column. If it is `TBD`, more than 90 days past its review date, or names a model you know has been replaced, still make the recommendation, note that the roster may be stale, and propose an update in a small, separate pull request that cites your source. Never invent model names; leave unsure entries `TBD` and ask the owner to confirm them from the model picker. Never edit another vendor's column.

## Review workflow

One agent may implement while another reviews. Reviewers should examine the issue, diff, validation evidence, permissions, failure paths, tests, and documentation. Leave specific, actionable comments. The implementing agent should respond, push fixes to the same branch, and summarize how each material comment was addressed.

Approval from an agent is advisory. It never authorizes a merge.

## Security and administration

- Never commit credentials, API keys, tokens, private keys, `.env` secrets, customer data, private production data, or credentials embedded in URLs.
- Use sanitized examples and documented environment-variable names.
- Authenticate externally exposed application APIs; document narrowly scoped public endpoints.
- Enforce authorization on the server. A hidden UI control is not a permission check.
- Audit significant administrative actions without logging secrets.
- Validate external inputs and handle unavailable dependencies explicitly.
- Avoid destructive commands and broad privilege changes outside the authorized scope.

## Completion

Before handing off, ensure the branch is pushed and its PR is current. Report:

- what changed and why;
- checks run and their results;
- documentation or ADR updates;
- known risks and unverified behavior;
- remaining work or blockers.

Keep tool-specific instruction files thin and point them here.

## This project: House Planner (`house-planner`)

Read `README.md` and `docs/product-vision.md` first. The owner's decisions so far are recorded there with dates; anything marked `TBD` or "proposed" is not decided.

### Tools and checks

The application stack is proposed in `docs/architecture.md` and not yet accepted. Until it is, the only check is the scaffold validation:

| Check | Command | Pass |
| --- | --- | --- |
| Scaffold | `pwsh -File ./scripts/Test-Template.ps1` | `Template validation passed` |

Add the application's build, test, and lint commands to this table in the same pull request that introduces them.

### Project rules

- Measurements are in inches throughout, shown to the owner as fractions (for example `23 5/8`).
- Cut sizes, cabinet sizes, and layout positions are used to cut real material. Changes to that math need automated tests that pin the expected numbers.
- Additional high-risk areas for the small-request test and review recommendations: cabinet and cut-size math, sheet layout and optimizer results, and the saved project file format.
