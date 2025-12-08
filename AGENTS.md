# Repository Guidelines

## Project Structure & Module Organization
- Entry point: `index.html` with `style.css` and `src/main.js` bootstrapping the game.
- Core sim/engine lives in `src/core` and `src/sim`; keep these DOM- and Three.js-free (see `docs/DEV_RULES.md` and `docs/FILE_MAP.md`).
- Rendering/UI layers reside in `src/render` and `src/ui`; configs and data definitions in `src/config/**`.
- Docs catalog behavior and events (`docs/ARCHITECTURE.md`, `docs/EVENTS.md`); assets (icons, sounds, images) in `assets/`; utility scripts in `scripts/` (e.g., `scripts/download-homelab-icons.sh`).

## Run, Build, and Test Commands
- Install deps (only needed for tooling/tests): `npm install`.
- Serve locally to avoid module/CORS issues: `python3 -m http.server 8000` from repo root, then open `http://localhost:8000/` and load `index.html`.
- No build step; code runs directly in the browser.
- No automated test suite yet; rely on targeted playtesting per the notes below.

## Coding Style & Naming Conventions
- ES modules with named exports where possible; 4-space indentation and semicolons are standard across `src/**`.
- Simulation helpers take `state` as the first argument; engine owns `{ simulation, ui }` state.
- Do not introduce DOM/Three.js inside sim or core modules; route UI/render effects through the engine event bus (update `docs/EVENTS.md` when emitting new events).
- Service/traffic behavior must come from configs (`src/config/serviceCatalog.js`, traffic profiles) rather than hardcoded conditionals.
- Avoid globals entirely; runtime/engine references come from imports or `utils/runtime` helpers.
- Use canonical terms from `docs/GLOSSARY.md` (e.g., Request, Service node, trafficClass); retire legacy variants when touching related code.

## Testing Guidelines
- Smoke-test sandbox, scenarios, and campaign start to ensure routing, budgeting, and reputation flows still behave; watch for console errors.
- Validate common actions: building/connecting services, upgrades, game over handling, and tutorial/menu interactions.
- If adding automation, puppeteer is available; aim to script “load page → start sandbox → place service → connect → advance time” flows.

## Commit & Pull Request Guidelines
- Use concise, imperative commits with optional scopes (`refactor:`, `fix`, `add ...`) similar to existing history.
- PRs should include: purpose/behavior changes, linked issue (if any), before/after notes (or screenshots/GIFs for UI), and test/QA steps performed.
- Call out documentation updates when you add/change events, configs, or user-facing flows.
