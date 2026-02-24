# Naming Glossary (collisions + canonicals)

| Concept | Variants Seen | Where Used | Canonical Term | Notes |
| --- | --- | --- | --- | --- |
| Packet/Request | `Request`, `packet`, `req` | sim/traffic, entities/Request, render/requestManager | **Request** | Use Request for the entity; avoid "packet" except in docs/UX. |
| Service/Device/Node | `service`, `node`, `device` | entities/Service, sim/tools, UI campaign spawning | **Service node** | Prefer "service" for catalog entries; "node" only for topology graph. |
| Traffic type/class | `trafficClass`, `type`, `trafficType` | traffic.js, routing.js, packetConfig | **trafficClass** | Enum values in TRAFFIC_CLASS; retire `type`/`trafficType`. |
| Packet phase | `phase`, `isResponse`, `inbound` | packetConfig, traffic.js | **phase** | Use PACKET_PHASE enum (REQUEST/RESPONSE). |
| Service kind/type | `kind`, `type`, `serviceType` | serviceCatalog, routing, Service | **kind** | Align with SERVICE_KIND entries; avoid `type`. |
| Mode/scenario/campaign | `mode`, `scenario`, `level`, `campaign` | modes/*, ui/campaign, ui/scenarios | **mode** for runtime controller; **scenario**/**campaign level** for content. |
| User/player | `user`, `player`, `internet` | trafficBehaviors, traffic.js | **user node** when referring to USER service; **player** only in text. |
| Reputation/satisfaction | `reputation`, `satisfaction` | sim/economy, levelConditions | **reputation** | Use satisfaction only in legacy comments. |
| Money/budget | `money`, `budget` | engine state, sandbox controls | **money** | Budget used for sandbox inputs; normalize to money. |
| Score | `score`, `points` | traffic.js, hudController | **score** | Keep `points` for config constants only. |
| Connection/link | `connection`, `link` | sim/tools, render/connectionManager | **link** in UI, **connection** in state objects. |
| Tool selection | `tool`, `activeTool`, `whitelist` | engine UI state, toolbarController | **tool** / **activeTool** | Whitelist describes allowed tools list. |
| Topology guidance/warnings | `topologyGuidance`, `warnings`, `topologyWarnings` | routing.js, engine state, hudController | **topology warning** | Warnings live on `simulation.topologyWarnings`; guidance array stays in UI for hints. |
| Engine/runtime/state | `engine`, `runtime`, `state`, `__POP_RUNTIME__` | bootstrap, modeManager, gameCore | **engine** (state), **runtime** (loop/controller) | Use `utils/runtime` getters/setters to pass the active engine; avoid window globals. |
