# ADR-001: Application stack

- Status: Accepted
- Date: 2026-11-01
- Decision maker: Repository owner (`benkoeslag`), accepted in chat on 2026-11-01
- Issue / PR: Package 1 of M1 (see `docs/roadmap.md`)
- Supersedes / superseded by: None

## Context

The owner wants a personal tool to draw the main floor of their house as a floor plan, see it in a simple 3D view from the start, and plan cabinetry against the real walls. It is single-user, has no accounts or server needs, and should work on the owner's computer and be easy to open as a link. A working single-file cabinet planner prototype (plain JavaScript in one HTML page) already exists and will be ported in a later milestone, so the stack should run JavaScript or TypeScript in the browser.

## Options considered

| Option | Benefits | Costs and limitations |
| --- | --- | --- |
| Browser app: TypeScript, Vite, three.js, Vitest | No install for users; shares a language with the prototype; three.js is a standard 3D library; typed code suits cut-size math; fast tests | Browser storage limits; file access goes through browser APIs |
| Single HTML file like the prototype | Simplest to share | Does not scale to a floor plan editor, 3D, and tests |
| Desktop framework first (Tauri or Electron) | Native file dialogs, installed app | Extra build and packaging work before any feature exists; can be added later around a browser app |
| Game engine (Godot, as in `fish-sticks`) | Strong 3D | Poor fit for precise 2D drafting, text, and tables; cannot reuse the prototype |

## Decision

Build a browser application in TypeScript with Vite as the build tool, three.js for 3D, and Vitest for tests. Projects are saved as local JSON files in inches, with browser storage for autosave. There is no server, account system, or external service. A desktop wrapper may be added later without changing the application code.

Dependencies are pinned to exact versions in `package.json`, and installs use the committed lockfile.

## Consequences

- Unit tests can pin cut sizes and layout results; the cabinet math will be ported as pure functions with tests (see `AGENTS.md`).
- CI runs a type check, tests, and a build on every pull request (`.github/workflows/app-ci.yml`).
- Dependabot proposes npm and GitHub Actions updates monthly.
- No secrets or private data are involved. The app makes no network requests.
- Saved project files become a compatibility surface; a later package defines a versioned format.

## Validation and references

- `npm run typecheck`, `npm test`, and `npm run build` pass locally and in CI.
- The built app opens in a browser and renders an empty 3D scene with no console errors.
- Library choices: [Vite](https://vite.dev), [three.js](https://threejs.org), [Vitest](https://vitest.dev).
