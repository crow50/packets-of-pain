# Flow: WEB packet from INTERNET to OBJECT_STORAGE

1) **Spawn**
- `gameTick` (src/sim/traffic.js) increments `spawnTimer`; when RPS threshold reached it calls `spawnRequest`.
- `spawnRequest` picks `trafficClass` via `getTrafficType` (defaults to CONFIG.survival distribution) → WEB likely.
- Source is chosen by `pickRequestSource` (mode behaviors or default `sim.internetNode`); Request constructed with phase REQUEST and pushed to `sim.requests`.
- Event `requestSpawned` emitted; render layer listens via engine emit.

2) **Initial routing**
- `routeInitialRequest` inspects internet connections using `listConnections`; builds `entryNodes` from connected services.
- If WAF exists it is preferred; otherwise picks `pickPreferredEntryNode` that accepts WEB (`acceptsClasses` includes WEB).
- Request `lastNodeId` set to internet; `flyTo(target)` enqueues in target queue when arrival completes.

3) **Processing through middle tier**
- Services process in `Service.update` → `processQueue` moves requests into `processing` up to capacity.
- When timer complete, routing decision obtained via `Routing.getNextHop` (spanning-tree based).
- For WEB, the terminal node resolved by `findTerminalNode` is an `OBJECT_STORAGE` (accepts/terminalClasses WEB). STP forwarding tables give next hop; load-balanced unless congestion reroutes.

4) **Termination and scoring**
- When routing returns `TERMINATE` at `OBJECT_STORAGE`, `Service.update` calls `finishRequest` → `updateScore(...,'COMPLETED')` adds WEB score/money and increments `sim.requestsProcessed`.
- `spawnInboundResponse` creates RESPONSE packet back to user only if original request was from USER; otherwise request removed.
- `requestFinished` event emitted; render/requestManager syncs meshes, HUD updates via `updateSimulationHud`.

5) **Rendering checkpoints**
- Every `requestSpawned`/`requestFinished`/`requestFailed` hits the engine emitter; `renderManagers.syncRenderState` builds/updates meshes from `state.simulation.requests` and `services` each frame.

Key fields tracked: `req.trafficClass='WEB'`, `phase` REQUEST→(optional) RESPONSE, `path[]`, `hops`, `deathReason` (should stay null if successful).
