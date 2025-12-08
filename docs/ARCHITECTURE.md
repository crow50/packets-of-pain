# Packets-of-Pain Architecture

This document explains how the game is wired: where state lives, how the simulation runs, and how UI/rendering layers talk to it.

If you’re changing game logic, adding features, or wiring new UI, read this first.
For coding rules and “do/don’t”, see `DEV_RULES.md`.

---

## 1. High-Level Overview

Packets-of-Pain is a browser-based 3D simulation game with:

* A **simulation engine** that models services, traffic, capacity, routing, and scoring.
* A **render layer** using Three.js to display nodes, links, and packets.
* A **UI layer** (HUD, toolbars, sandbox panel, campaign screens) on top of the sim.
* A **runtime/bootstrap layer** that wires them together.
* A **config layer** for services, traffic profiles, and levels.

The core loop:

1. Engine ticks the simulation (`engine.step(dt)`).
2. Simulation updates services, packets, economy, metrics.
3. Renderer reads simulation state and updates meshes.
4. UI reads simulation/UI state and updates HUD/tooltips.
5. Player actions (clicks, tool changes, sandbox sliders) call engine methods.

---

## 2. Runtime & Engine

### 2.1 Runtime

**File(s):** `src/bootstrap.js` (and any runtime helpers)

The runtime is responsible for:

* Creating a new **engine** for the current mode.
* Creating the **scene/renderer** and attaching it to the DOM.
* Creating the **input controller** and HUD/UI controllers.
* Driving the **main loop** that calls `engine.step(dt)` + `renderer.render()`.
* Starting/stopping/restarting modes cleanly.

Conceptually:

```text
bootstrap / runtime
  ├─ createEngine(engineConfig)
  ├─ createScene({ engine, modeConfig })
  ├─ createInputController({ engine, scene })
  ├─ createHudControllers({ engine })
  └─ createLoop({ engine, scene, hud })
```

Mode switches happen through `modeManager` (and thin wrappers in `src/ui/navigation.js`) so UI code can swap modes without touching globals. Runtime/engine handles are kept in `utils/runtime` so controllers can grab the current engine without `window.*`.

Internally, a `runtime.current` object holds `{ engine, scene, input, loop, modeConfig }` and is used by things like restart/reset.

---

### 2.2 Engine

**File:** `src/core/engine.js`

The engine is the **single source of truth** for game state.

State shape:

```js
{
  simulation: {
    // Numbers, timers
    time,
    money,
    reputation,
    score,             // breakdown by traffic type, fraud blocked, etc.

    // Topology & traffic
    services,          // Service entities
    requests,          // Request entities
    connections,       // links between services
    internetNode,      // pseudo-service for packet ingress (always present)

    // Traffic / spawn
    currentRPS,
    spawnTimer,
    trafficProfile,      // optional active profile
    trafficDistribution, // WEB/API/FRAUD mix
    packetIncreaseInterval,

    // Capacity & metrics
    metrics: {
      droppedByReason,
    },

    // Mode context and sandbox knobs
    activeMode,          // 'sandbox' | 'campaign' | 'scenarios'
    campaignLevel,       // current level ID when inside campaign
    scenarioId,          // current scenario ID when inside scenarios mode
    upkeepEnabled,
    burstCount,
    topologyWarnings,  // misconfig issues, if any
    routing: { spanningTree, topologyRevision },
  },

  ui: {
    activeTool,
    selectedNodeId,
    hovered,           // hover info
    isRunning,
    timeScale,
    sound,             // sound service
    toolbarWhitelist,
    linkSourceId,
    linkBidirectional,
    topologyGuidance,  // UI hints (separate from sim warnings)
  }
}
```

The engine exposes:

* **Getters:**

  * `getState()` - full `{ simulation, ui }` object.
  * `getSimulation()` - simulation state only.
  * `getUIState()` - UI state only.
  * `getStats()` - condensed snapshot for HUD/scoring.

* **Core loop:**

  * `step(dt)` - advances time, runs traffic/economy/services/routing, checks for game over/failure, updates metrics.

* **Commands (simulation changes):**

  * Service/topology: `placeService`, `connectNodes`, `deleteNode`, `deleteLink`, `upgradeService`, `clearAllServices`.
  * Traffic & economy knobs: `setRPS`, `setTrafficDistribution`, `setBurstCount`, `setSandboxBudget`, `toggleUpkeep`, `setTrafficProfile`.
  * Game control: `setRunning`, `setTimeScale`, `reset(modeConfig)`.

* **Commands (UI state):**

  * `setActiveTool`, `setSelectedNode`, `setLinkSource`, `setToolbarWhitelist`, `setTopologyGuidance`, `setHovered`, `setSoundService`.

Simulation helpers (`traffic`, `economy`, `tools`, `routing`, `Service`, `Request`) all accept `state` as their first argument and operate on `state.simulation` / `state.ui` instead of global variables.

---

## 3. Simulation Layer

**Folder:** `src/sim/` (and some parts of `src/entities/` and `src/core/routing.js`)

The simulation layer is responsible for:

* Spawning and routing requests.
* Processing queues and capacity.
* Updating budget and reputation.
* Evaluating failure modes (overload, misconfig, fraud leakage).
* Maintaining metrics and statistics.

Key modules:

* `traffic.js` - request spawn & per-tick evolution

  * `gameTick(state, dt)`
  * Uses `currentRPS`, `trafficProfile`, `trafficDistribution`, and routing to spawn and move requests.

* `economy.js` - budget/reputation/time scale & mode resets

  * `resetEconomyForMode(state, modeConfig)`
  * `setBudget(state, value)`
  * `setTimeScale(state, s)`
  * Sandbox knobs (upkeep toggle, etc.) are respected here and in `Service` logic.

* `routing.js` - catalog-driven routing decisions

  * `getNextHop(state, request, currentService)` -> `{ action: "TERMINATE"|"BLOCK"|"FORWARD"|"DEAD_END", node }`
  * Helpers: `isBlocked`, `isTerminal`, `accepts`, `validateTopology`, `getMostLoadedService`.
  * Only this module decides routing behavior; service types read from `serviceCatalog`.

* `entities/Service.js` - per-service logic

  * Tracks tier, capacity, load (processed, capacity, utilization, dropped).
  * `processQueue(state, dt)` enforces capacity & overload:

    * Max `capacity * dt` per tick.
    * Overflow -> drops, rep penalty, metrics.
  * Uses routing to decide what to do with each request.
  * Uses `serviceCatalog` for stats (capacity, processingTime, cost, etc.).

* `entities/Request.js` - per-request logic

  * Movement between nodes (including link “latency” if configured).
  * Delegates next-hop decisions to `routing`.
  * Calls into sim helpers to finish/block/fail requests.

The simulation layer **never** touches the DOM or Three.js directly and never assumes a particular camera or HUD layout.

---

## 4. Render Layer (Three.js Scene)

**Folder:** `src/render/`

Responsible for:

* Creating and updating the Three.js scene.
* Visualizing services, connections, and requests.
* Visualizing load/utilization, drops, and warnings.

Key module:

* `scene.js`

  * Builds the scene (lights, camera targets, groups for services/links/requests).
  * Maintains id -> mesh maps for services and connections.
  * Reads state via `engine.getSimulation()` and updates:

    * Node positions
    * Connection lines
    * Packet meshes
    * Load rings / colors for utilization
  * Handles special nodes like the internet entry node.

The render layer **does not** mutate `simulation.services`, `requests`, or `connections`. It reacts to engine state and keeps its own Three.js objects in sync.

---

## 5. UI / HUD / Input

**Folder:** `src/ui/`

Responsible for:

* HUD overlays (budget, reputation, load, hottest node, warnings, score).
* Toolbars for placing services, deleting, connecting, etc.
* Sandbox panel for live tuning in sandbox mode.
* Menus (main menu, help, pause, hamburger/ellipsis).
* Mapping mouse/keyboard input to engine commands.

Key modules (names may vary slightly):

* `hudController.js`

  * Updates budget, reputation, RPS, score, “hottest node,” topology warnings.
  * Shows game over / victory panels based on engine stats.
  * Reads state snapshots via `engine.getStats()` / `engine.getSimulation()`.

* `inputController.js`

  * Handles mouse events (click, drag, hover).
  * Tracks active tool, selected node, hovered node.
  * Calls engine commands: `placeService`, `connectNodes`, `deleteNode`, `setActiveTool`, etc.

* `interactions.js`

  * Tooltip content and selection/highlight logic, driven by engine state and `serviceCatalog`.
  * Shows service details, load, capacity, drops, traffic handling (“Accepts/Blocks/Terminal for”).

* `sandboxController.js`

  * Sandbox sliders/buttons for:

    * Budget
    * RPS
    * WEB/API/FRAUD mix
    * Burst count (and burst buttons)
    * Upkeep toggle
    * Clear all
  * Calls engine sandbox APIs: `setSandboxBudget`, `setRps`, `setTrafficMix`, `setBurstCount`, `spawnBurst`, `toggleUpkeep`, `clearAllServices`.
  * Only visible in sandbox mode.

* `menuController.js` / HUD menu

  * Hamburger/ellipsis menu near the time panel.
  * Controls help overlay, sound toggles, “Return to Main Menu”.
  * Uses engine UI state for sound (`engine.getUIState().soundMuted`, etc.) and calls runtime/POP API for main menu transitions.

### HUD Layout & Modes

The HUD now uses a **zone-based layout** so panels never overlap:

1. **Top-left (`#hud-top-left`)** – the stats card plus the warnings stack (`#warnings-pill` + `#topology-warnings-section`) share this column so issues surface directly beside the metrics they impact.
2. **Top-center (`#hud-top-center`)** – time controls and the HUD menu button sit together, centered over the canvas.
3. **Top-right (`#hud-top-right`)** – the score card occupies the entire column with consistent spacing.
4. **Right column (`#hud-right-column`)** – stacked glass panels with scrollable content. `#tutorial-box` sits at the top, `#campaign-panel` and the new `#scenarios-panel` share the objectives slot (never visible at the same time), and `#sandbox-panel` only appears in sandbox runs. `#details-panel` (hottest node) always anchors the bottom of the stack.
5. **Bottom center (`#bottom-toolbar`)** – build tools + shop, centered and always above the canvas.
6. **Floating overlays** – tooltips (`#tooltip`), modals, and onboarding live above everything else.

`setModeUIActive(modeId, options)` records the currently running mode, applies matching `body` classes, and decides whether the objectives slot should be visible at all. `setHUDMode(mode)` syncs the visible panels (`'campaign'`, `'sandbox'`, `'scenarios'`, or `null` for menus) while honoring that visibility flag so e.g. sandbox can hide the objectives slot entirely. The warnings flow is pill-driven: `initWarningsPill()` wires the pill tap/click to expand `#topology-warnings-section` directly beneath the stats column while `hudController.updateTopologyWarnings` pushes the latest issues and badge counts.

**Scenario Briefing Panel.** Scenarios now render into their own DOM panel (`#scenarios-panel`) so the campaign briefing never needs to carry scenario-specific UI. `hud.js` exposes `setScenarioPanelTitle/Subitle/Summary/Difficulty/Tags/Status` plus `renderScenarioObjectives`, and `scenariosController.loadScenarioSession` calls those helpers after loading a config. The panel listens for `pop-timeScaleChanged` so its status badge flips between `Paused` and `Live` automatically when the player changes time scale. Campaign still uses the original panel helpers, so the two modes stay isolated while sharing the same right-column real estate.

Responsive rules keep the entire top row wrapping under `1280px` and collapse the right column under `768px`, so the HUD still fits on smaller displays without overlapping the canvas or toolbar.

The UI layer never directly mutates simulation arrays and never calls sim helpers like `gameTick` or `createService` directly; it always goes through the engine and runtime.

---

## 6. Config Layer

**Folder:** `src/config/`

Responsible for defining data, not behavior:

* `serviceCatalog.js`

  * `SERVICE_TYPES` catalog: key, label, baseCost, upkeepPerTick, processingTime, tiers, accepts, blocks, terminalFor, category, subtitle, icon, compromise behavior, etc.
  * Includes pseudo-devices such as `INTERNET`, which is marked `drawable: false` and is instantiated only by the engine/level config so packets always have a single ingress node.
  * Helper functions: `getServiceType`, `getCapacityForTier`, `getUpgradeCost`, `canUpgrade`.
  * All service-specific logic should pull from this.

* `trafficProfiles.js` (when present)

  * Named traffic profiles for levels/sandbox:

    * base RPS
    * wave definitions (duration, WEB/API/FRAUD mix over time).

* `campaign/` (e.g., `src/config/campaign/index.js`, domain-level files)

  * Domains own their metadata plus an array of level definitions (starting budget, traffic profile, toolbar whitelist, objectives, win/fail conditions, etc.).

    * Files follow the `DOMAIN_<UPPER_SNAKE_NAME>` naming pattern (matching the file slug) and export both the metadata object and a `DOMAIN_<UPPER_SNAKE_NAME>_LEVELS` array so the campaign registry can gather them automatically.
  * Levels can optionally set `internetPosition` so the engine places the Internet node (and therefore the packet spawn location + mesh) where the scenario wants it.
  * The `campaign` index builds domain/level caches and exports helpers such as `getLevelsForDomain` and `getLevelById` so UI, shop, and runtime code can stay in sync without a global `LEVELS` map.
  * See `docs/LEVELS.md` for guidance on extending domains or adding new campaign levels.

* `config.js`

  * General game constants and defaults.
  * Legacy `CONFIG.services` can be generated from `serviceCatalog` for older code paths, but `serviceCatalog` is the actual source of truth.

The config layer should be purely data: no DOM calls, no engine calls.

Controllers, HUD modules, and interaction helpers are wired during bootstrap with a runtime engine reference; they should call `engine.getState()`, `engine.getSimulation()`, or `engine.getUIState()` instead of reaching for global helpers or private modules so the controller logic always reflects centralized engine state (campaign/sandbox/scenario context, objectives, tool state, etc.).

---

## 7. Game Modes

Game modes are driven by `simulation.activeMode` and mode-specific config passed to the engine; campaign levels and scenario IDs surface through `simulation.campaignLevel` and `simulation.scenarioId`.


* **Sandbox**

  * Adjustable budget / RPS / traffic mix / upkeep / bursts.
  * No game over; meant for experimentation.
  * Sandbox panel visible.
  * RPS ramp-up and strict failure conditions are usually disabled.

* **Campaign**

  * Level-driven traffic profiles and objectives.
  * Game over and level completion.
  * Campaign hub and objectives panel visible.

* **Scenarios**

  * One-off scripted challenges that reuse the simulation but not the campaign progression tree.
  * Loads scenario configs from `src/config/scenarios/`, including tutorials and win/fail conditions.
  * Uses the dedicated Scenario Briefing panel helpers in `hud.js` so tags, objectives, and difficulty badges can diverge from the campaign UI without impacting sandbox or level play.

Mode transitions are handled by the runtime/bootstrap layer; the engine is created with a mode-specific config and never needs to know about DOM views.

---

## 8. Data Flow Summary

* **Downwards (engine -> renderer/UI):**

  * Engine exposes state snapshots and stats via `getSimulation`, `getUIState`, `getStats`.
  * Renderer and UI read these snapshots and update visuals.

* **Upwards (UI/input -> engine):**

  * Input and UI call engine commands to change state (place services, change tools, adjust sandbox knobs, pause/resume).

* **Sideways (simulation helpers):**

  * Simulation modules talk to each other via `state` + shared config (service catalog, traffic profiles, levels), not via globals.

---
