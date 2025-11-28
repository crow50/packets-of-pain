# Packets-of-Pain Dev Rules

These rules exist so the game stays debuggable, extensible, and fun to work on.
If a change violates them, it’s probably going to turn into pain (of the wrong kind).

## 1. Engine & State

- Engine is the only owner of game state (`{ simulation, ui }`).
- No new writes to `STATE`. All mutations go through engine or state-accepting helpers.
- Sim helpers must accept `state` as their first parameter (`fn(state, ...)`).
- UI reads state via `engine.getSimulation()` and `engine.getUIState()` only.

## 2. Simulation

- No DOM or Three.js in sim modules (`traffic`, `economy`, `routing`, `tools`, core entity logic).
- All service behavior (capacity, cost, accepts/blocks/terminal) comes from `serviceCatalog.js`.
- All routing decisions go through `routing.getNextHop(...)`.
- Overload/drops and reputation penalties are implemented in one place and tracked via `sim.metrics`.

## 3. UI, Input, Render

- UI never calls sim helpers directly; it calls engine methods.
- Input decides what action to take (build/connect/delete) and calls engine APIs.
- Renderer reads from engine state and owns meshes, but does not mutate sim arrays.

## 4. Game Modes

- `simulation.gameMode` controls mode-specific behavior.
- Sandbox has no game over and exposes controls for budget, RPS, traffic mix, upkeep, bursts, and clearing.
- Sandbox controls talk only to engine methods; they never mutate arrays directly.
- Campaign levels are defined in config, not hardcoded conditionals.

## 5. Config & Data

- `serviceCatalog.js` is the source of truth for all service definitions.
- Traffic profiles are data (`trafficProfiles.js`) consumed by `traffic.js`.
- Level behavior comes from config, not inline `if (levelId === ...)` checks.

If you’re about to write code that needs to mutate state, talk to routing, or affect services/traffic:
**stop and make sure you’re doing it via the engine, the catalog, or a sim helper that takes `state`.**
