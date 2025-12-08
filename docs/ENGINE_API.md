# Engine vs UI Contract

## Engine core (no DOM)
- `src/core/engine.js`: lifecycle state, event bus, tick driver via `gameTick`.
- `src/core/routing.js`: catalog-driven routing + spanning-tree forwarding.
- `src/sim/traffic.js`: packet lifecycle (spawn → route → score → remove) and RPS ramp.
- `src/entities/Request.js`: packet entity + TTL + hop/path tracking.
- `src/entities/Service.js`: service node, queue/processing, routing handoff.
- `src/sim/spanningTree.js`: STP tables for routing; congestion-aware alt paths.
- `src/sim/tools.js`: create/delete services and links.
- `src/sim/economy.js`: money/reputation/time scale helpers; traffic profiles.
- `src/core/modeManager.js` + `src/modes/*`: choose behaviors per game mode.
- `src/config/*`: packet/service/catalog/constants used by engine (no DOM).

## UI / DOM shell
- `src/render/*`: Three.js scene, meshes, interactions, request/service visuals.
- `src/ui/*`: HUD, menus, tutorial, toolbars, campaigns, scenarios, inputs.
- `src/services/SoundService.js` + `src/services/AssetService.js`: media loading.
- `src/bootstrap.js`, `src/main.js`, `src/gameCore.js`: wire engine to DOM, modes, render loop.

## Contract (North Star)
- Engine code must not touch `document`/`window` for DOM access; it exposes state + events only.
- UI code calls engine APIs (`createEngine`, mode controllers, `setTool`, etc.) and should not mutate engine internals directly.
- No globals: engine/runtime references live in `utils/runtime` and are injected from `bootstrap`/`modeManager`; routing/catalog/tool helpers are module imports only.
- Data flow: UI -> engine via method calls and event handlers; engine -> UI via emitted events (`requestSpawned`, `requestFinished`, etc.) and state getters.
- Rendering/services consume pure data from engine state (services, requests, topology) and avoid DOM or window usage inside engine modules.
