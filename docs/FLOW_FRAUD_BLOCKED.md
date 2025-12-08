# Flow: FRAUD packet hitting WAF and blocked

1) **Spawn**
- `spawnRequest` can select FRAUD via `getTrafficType` distribution (CONFIG.survival or sandbox overrides). Phase defaults to REQUEST.
- Source is usually internet; Request pushed to `sim.requests` and `requestSpawned` emitted.

2) **Initial hop preference**
- `routeInitialRequest` builds entry nodes from internet links. When WAF exists it is chosen first; otherwise first accepting node.
- Request flies to WAF queue; `lastNodeId` = internet.

3) **Processing at WAF**
- `Service.update` processes jobs; routing decision fetched via `Routing.getNextHop`.
- `evaluateCatalogRules` in routing sees WAF `blocksClasses: ['FRAUD']` → returns `{action:'BLOCK'}`.
- `Service.update` handles BLOCK by calling `updateScore(req,'FRAUD_BLOCKED')` and `removeRequest(req)`.
- Reputation unaffected; `sim.score.fraudBlocked` incremented; `sim.metrics.droppedByReason` untouched.

4) **Events & rendering**
- `requestFailed` is *not* emitted on BLOCK; instead request removed after score update. (Only `requestFinished` on completes and `requestFailed` on failRequest.)
- Render state sync removes request mesh on next frame via `renderManagers.syncRenderState` reading `sim.requests`.

5) **Alternate path**
- If no WAF/Firewall present, FRAUD may proceed; routing rules will eventually DEAD_END or reach terminal if misconfigured. In misconfig case, `failRequest` sets reputation penalty (`FAIL_REPUTATION` via updateScore). Adding WAF early prevents FRAUD from consuming downstream capacity.
