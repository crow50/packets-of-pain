# Routing & Packet Flow

This document captures the current routing pipeline, the working definitions of packets and devices, known implementation gotchas, and areas earmarked for improvement. It reflects the Phase 4 state of the STP rollout (connection metadata + bidirectional control) while Phase 5 test finalization remains intentionally deferred.

## Terminology & Data Shapes

### Packets (`Request` instances)
- Spawned via `src/sim/traffic.js` and represented by `src/entities/Request.js`.
- Key fields:
  - `type`: logical traffic class (`WEB`, `API`, `FRAUD`, `INBOUND`, etc.).
  - `path`: ordered node ID history for debugging.
  - `lastNodeId`: node that most recently forwarded the packet.
  - `hasCompute`: flag set after passing through compute nodes; used to short‑circuit workloads.
  - `isResponse`/`targetUserId`: track user responses spawned after successful delivery.
- Movement: `flyTo(node)` animates a hop and queues on arrival; TTL limited via `MAX_HOPS`.

### Devices (services & Internet node)
- Realized by `src/entities/Service.js`; catalog definitions live in `src/config/serviceCatalog.js`.
- Catalog fields drive routing decisions:
  - `accepts`: traffic classes a device will forward.
  - `blocks`: classes it explicitly drops (used for fraud/security logic).
  - `terminalFor`: classes that complete at this node.
- Device instances track:
  - `connections`: upgraded to connection objects with `{ targetId, bidirectional, linkCost, portRole, active, linkId }`.
  - `queue`/`processing`: influence congestion calculations.
  - `load.utilization`: consumed by congestion checks and STP weights.

### Connections & Directionality
- Created via `createConnection` in `src/sim/tools.js` using `window.ConnectionUtils` helpers.
- Bidirectionality defaults to `true`, governed by the toolbar toggle (`linkBidirectional`).
- One-way links push a forward edge only; reverse edges are omitted, and STP/routing respect the missing path.

## Current Routing Process

1. **Packet Spawn**
   - `traffic.js` chooses a source (Internet or mode-specific behavior) based on `trafficProfile`.
   - Initial target chosen from Internet neighbors, preferring WAF or catalog-acceptable nodes.

2. **Service Processing**
   - Each service drains its queue up to capacity per tick.
   - Before forwarding, routing catalog rules (`accepts`, `blocks`, `terminalFor`) short-circuit obvious outcomes.

3. **Routing Decision (`src/core/routing.js`)**
   - Evaluate catalog rules for block/terminal/dead-end first.
   - If `enableStpRouting` flag true, consult spanning tree forwarding tables.
   - Otherwise, fall back to legacy best-load neighbor selection (still respects catalog `accepts`).

4. **Spanning Tree Construction (`src/sim/spanningTree.js`)**
   - Builds an adjacency map from active connection objects after normalizing via `ConnectionUtils.listConnections`.
   - Only adds reverse edges when `conn.bidirectional === true`.
   - Uses Dijkstra-like weighting: base `DEFAULT_LINK_COST` plus congestion penalty.
   - Produces forwarding tables keyed by source node → destination → next hop.

5. **Enforcement of Directionality**
   - One-way links simply do not appear in the reverse adjacency set, so packets cannot choose that path during STP or legacy traversal.
   - UI toggle defaults to bidirectional and persists in engine UI state; connection creation reads the current flag.

## Implementation Steps / How-To

1. **Define/Update Device Types**
   - Edit `serviceCatalog.js` to add or adjust catalog entries.
   - Include `accepts`, `blocks`, `terminalFor`, capacity tiers, and UI metadata.

2. **Configure Packet Behavior**
   - Update traffic profiles (modes, scenarios, campaign levels) to control spawn rates and sources.
   - Extend `TRAFFIC_TYPES` if new packet classes are needed, ensuring catalog rules cover them.

3. **Wire Connections**
   - Use in-game toolbar or preplaced configs to create connections.
   - For scripted setups, call `createConnection(state, fromId, toId, { bidirectional, linkCost })`.

4. **Trigger Routing Validation**
   - `window.Routing.validateTopology()` runs automatically after create/delete, but can be called manually when bulk editing state.
   - Watch HUD warnings for missing terminal paths.

5. **Spanning Tree Tuning**
   - Toggle feature flag (`CONFIG.routing.enableStpRouting` or per-simulation flag) to switch between STP and legacy routing.
   - Adjust congestion weights and link costs in `spanningTree.js` or `ConnectionUtils` to fine-tune behavior.

## Gotchas & Current Limitations

- **Engine Runtime Dependency**: UI toggles depend on `window.__POP_RUNTIME__`; ensure runtime ready before interacting.
- **Legacy Routing Fallback**: If STP tables fail to find a terminal node, packets revert to load-based neighbor picks, which can still loop if topology is invalid.
- **Catalog Accuracy**: Misconfigured `accepts`/`blocks` arrays will cause unexpected drops or dead ends. Keep documentation in sync.
- **Connection Metadata Drift**: Legacy save data with string connections must be normalized via `ConnectionUtils.upgradeConnectionFormat` before routing reads them.
- **Testing Gap**: Phase 5 automated tests intentionally postponed; exercise scenarios manually after topology changes.

## Future Improvements

1. **Packet/Device Schema Docs**
   - Create dedicated `PACKETS.md` and `SERVICES.md` to formalize catalog keys, runtime fields, and extension hooks.
2. **Configurable Routing Recipes**
   - Allow scenarios/modes to supply custom routing policies (e.g., per-packet constraints, QoS weighting).
3. **Validation & Test Harness**
   - Fill in Phase 5 with regression tests that simulate mixed-direction links, congestion spikes, and packet lifecycles.
4. **Edge Device Rules**
   - Enforce which device classes may touch the Internet node, documenting exceptions and UI feedback.
5. **Visualization**
   - Add HUD overlays for link direction and STP tree to debug loops quickly.

---

_Last updated: Phase 4 (connection metadata and bidirectional toggle). Testing finalization is deferred; revisit once packet/device documentation is complete._
