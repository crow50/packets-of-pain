# Flow: API packet from INTERNET to DATABASE

1) **Spawn**
- Triggered by `gameTick` → `spawnRequest`; `getTrafficType` selects API per distribution.
- Source defaults to `sim.internetNode` unless mode-specific `pickTrafficSource` overrides.
- Request added to `sim.requests`; event `requestSpawned` emitted.

2) **Initial hop**
- `routeInitialRequest` chooses entry nodes connected to internet; WAF preferred if present, otherwise any accepting API.
- `flyTo` moves request to first service queue; `lastNodeId` set to internet.

3) **Processing path**
- Services process in `Service.update`; routing decision uses `Routing.getNextHop` with spanning-tree tables.
- Terminal for API is `DATABASE` (serviceCatalog terminalClasses includes API). Typical chain: INTERNET → WAF (blocks FRAUD) → LOAD_BALANCER (routing) → COMPUTE (sets `hasCompute`) → DATABASE.
- If a hop lacks acceptsClasses for API, routing returns DEAD_END → `failRequest(...,'misconfig')` with reputation penalty.

4) **Termination & scoring**
- At DATABASE, routing returns TERMINATE → `finishRequest` increments API score/money and emits `requestFinished`.
- Response packets only spawn for WEB/API when original source is USER; most API from internet will not spawn inbound response.

5) **Failure cases**
- Congestion: `Routing.getNextHop` tries alternate neighbor if next hop congested; otherwise may DEAD_END.
- TTL: `Request.update` drops when hops exceed `MAX_HOPS` → `failRequest` sets deathReason TTL_EXPIRED.
- Queue overflow: `Service.update` triggers `failRequest` with `misconfig` when routing returns DEAD_END or queues exceed max.

HUD/render hooks: same as WEB flow via engine events and HUD update functions.
