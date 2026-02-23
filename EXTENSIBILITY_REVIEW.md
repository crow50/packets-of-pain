# Extensibility Review: Packets of Pain

## 1. Level System
**Current State:**
- **Non-Existent:** The game currently operates on a single "Survival" mode with hardcoded infinite scaling (`CONFIG.survival.rampUp`).
- **Logic:** Difficulty assumes a linear increase in Requests Per Second (RPS) inside the `animate()` loop in `game.js`.
- **Configuration:** `CONFIG.survival` holds the starting parameters, but there is no array or structure to define multiple levels (e.g., Level 1: Low RPS, Level 2: High RPS + new enemies).

**Extensibility Assessment:**
- **Hard to Add Levels:** To add 10 levels, you would need to:
    1.  Refactor `CONFIG` to support an array of level configurations.
    2.  Modify `resetGame()` to accept a `levelIndex` or configuration object.
    3.  Implement a "Level Complete" condition (currently only "Game Over" exists).
- **Recommendation:**
    - Create a `LevelManager` class.
    - Define levels in `src/levels.js` (e.g., `[{ targetScore: 1000, maxRPS: 5 }, ...]`).
    - Decouple the "ramp up" logic from the main loop and make it driven by the Level Manager.

## 2. Routing Engine
**Current State:**
- **Traffic Flow:** Hardcoded, "Next-Hop" Logic.
    - **WAF/ALB:** Uses simple Round-Robin (`this.rrIndex % candidates.length`). It blindly sends to the next connected node without checking load.
    - **Compute:** Uses a `find()` search to locate a connected DB or S3 node. It picks the *first* match, ignoring load balancing if multiple DBs are connected.
- **Algorithm:** No graph traversal (A* or Dijkstra). It uses local knowledge only (immediate neighbors).
- **Performance:** **Poor scaling.**
    - inside `Service.update()`:
      ```javascript
      // O(N) lookup for EVERY connection for EVERY request completion
      const candidates = this.connections.map(id => STATE.services.find(s => s.id === id));
      ```
    - With 1000 nodes, `STATE.services.find` allows $O(N)$ complexity. If a Load Balancer handles 100 requests/sec, and has 10 connections, that's $100 \times 10 \times 1000$ operations = 1,000,000 checks per second just for lookups.

**Extensibility Assessment:**
- **Rigid:** Adding a new service type requires modifying `Service.js` (render logic, routing logic) and `game.js` (connection validation).
- **Recommendation:**
    - **Optimization:** Change `STATE.services` to a `Map<String, Service>` for $O(1)$ lookup.
    - **Caching:** Services should cache references to their connected neighbors (`this.connectedServices`) instead of resolving IDs every frame.
    - **Logic:** Implement a `Router` strategy pattern so new services can define their own routing logic (e.g., `LeastConnectionStrategy` vs `RoundRobinStrategy`) without modifying the core `Service` class.

## 3. Odds and Ends (Refactors & Bugs)
- **Global Scope Pollution:** `calculateFailChanceBasedOnLoad` is defined in `game.js` but relied upon in `Service.js`. If `game.js` isn't loaded first or changes, `Service.js` crashes. Move to a `utils.js`.
- **Hardcoded Visuals:** `Service.js` contains a massive `switch` statement for geometry/materials. This should be moved to a `ServiceRenderer` or defined in `CONFIG` (e.g., model paths/primitive types).
- **Connection Logic:** `game.js` contains hardcoded rules for valid connections (`if (t1 === 'waf' && t2 === 'alb')...`). This makes adding new node types (e.g., "Cache" or "CDN") difficult. Move connection rules to `CONFIG.services`.
- **UI Coupling:** `game.js` directly manipulates DOM elements (`document.getElementById`). A UI Manager or Event Bus should be used to decouple logic from presentation.
- **Audio:** `new Audio('assets/...')` is created on the fly in `game.js`. This can cause lag. Preload sounds in `SoundService`.

## Summary
The current codebase is a prototype. It works for a small, single-level game but will struggle significantly with scale (1000 nodes) or content expansion (new levels/services). Refactoring the **Data Structure (Array -> Map)** and **Connection Logic (Hardcoded -> Config-driven)** are the highest priority tasks.
