# Execution plan: BOOT-009 Cabinet engine (M2 package 2)

| | |
| --- | --- |
| Task | Owner, 2026-11-01: "Go ahead with package 2". This is the cabinet engine: parts, hardware and the cut list, with golden tests from the prototype (see `docs/roadmap.md`, `docs/cabinet-rules.md`). Work record BOOT-009. |
| Branch | `agent/claude/m2-cabinet-engine` |
| Pull request | #9 (draft) |
| Started | 2026-11-01, Claude Code (Opus 5.5) |
| Status | In progress |

## Goal and done-when

`src/cabinets/` turns one cabinet's inputs plus the cabinet settings into exactly the prototype's parts, fronts, hardware and warnings. It also turns a list of parts into the prototype's grouped, numbered cut list, with grain choices. This is done when:

- Golden tests compare the engine with fixtures generated from the prototype itself, covering every cabinet type and the settings that change the math, and they match.
- The worked examples in `cabinet-rules.md` are pinned in readable tests.
- Typecheck, tests and build pass. The docs and review queue are updated.

**Out of scope** (later packages):

- sheet layouts, the optimizer, consumables and costs (package 3)
- wall layout, corners on the plan, countertop, toe kick and file version 2 (package 4)
- any UI

## Steps

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

1. [x] Create this plan, push it, and open a draft PR (#9)
2. [x] Fixture generator: `scripts/prototype-fixtures.mjs` loads the unchanged prototype in headless Chromium and records `buildCab` output for a list of cases, plus a cut list. Commit the generated `tests/fixtures/prototype-cabinets.json`.
3. [x] `src/cabinets/settings.ts` (defaults from the prototype's `DEF`) and `src/cabinets/types.ts` (cabinet inputs, parts, fronts, hardware, warnings)
4. [~] `src/cabinets/build.ts`: boxes, doors, drawers, shelves, and the three base layouts
5. [ ] `src/cabinets/build.ts`: blind base, blind upper, diagonal upper, gables, tall, open shelf, open spaces, custom parts
6. [ ] `src/cabinets/cutlist.ts`: grain, grouping keys, order, numbering, banding length, hardware totals
7. [ ] Tests: golden comparison with the fixtures, worked examples, and cut list behavior
8. [ ] Docs (architecture, cabinet rules, review queue R-017, work record, roadmap), checks, PR description, mark ready

## Next action

Steps 4 and 5: write `src/cabinets/build.ts`, porting `buildCab` and `buildDiag` (prototype lines 530–742) to `buildCabinet(input, settings, id)`. Use `fmt` from `src/cabinets/format.ts` for messages, so they match the prototype's text. Result fields follow `BuiltCabinet` in `types.ts`, which matches the fixture's `expected` objects.

## Decisions made while working

- The engine takes typed numbers, not the prototype's text fields. Parsing typed text stays in the UI (package 5). Empty optional fields are `undefined`, meaning "use the default", exactly where the prototype uses its defaults.
- Settings keep the prototype's key names. `gapAt` ("leftover space goes") is kept as a project setting for package 4.
- The result keeps the prototype's field names (W, H, D, EW, hw, warns), so the golden tests compare directly with no mapping.
- The blind side is an input (`left` or `right` as faced). The prototype works it out from the wall (left wall → right). Package 4 will work it out from the run and corner.
- **Fixtures come from running the prototype**, not from hand math. The generator is a manual developer script. It needs Playwright, which is not a project dependency, and is not run in CI.

## Tried and did not work

- The generator needs Playwright from the global install: `NODE_PATH=$(npm root -g) node scripts/prototype-fixtures.mjs` in this environment.

## Checks run

- Fixture generator ran: 91 cabinet cases and 4 cut lists, from the unchanged prototype. The starter cut list has 85 groups and 4027.10 in of banding.

## Open questions for the owner

None.

## Handoff log

| When | Agent | Note |
| --- | --- | --- |
| 2026-11-01 | Claude Code (Opus 5.5) | Started |
