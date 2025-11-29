# Packets-of-Pain Engine Events

The engine exposes a **publish/subscribe bus** so UI and render layers can react to simulation changes without the sim helpers touching DOM or Three.js. All current and future engine events must be listed here (data catalog) and be triggered via `engine.emit(eventName, payload)`.

## Rules

1. Every event name must be documented below. No undocumented events.
2. Events are for **render/UI side effects only**; simulation helpers must mutate `state` and emit the event, but must never read or write DOM/Three.js.
3. List the payload schema for every event so render/UI listeners can trust the data.

## Events Catalog

| Event | Payload |
| --- | --- |
| `serviceAdded` | `{ serviceId, type, position }` |
| `serviceRemoved` | `{ serviceId }` |
| `serviceUpgraded` | `{ serviceId, tier }` |
| `upgradeFailedInsufficientFunds` | `{ serviceId }` |
| `connectionCreated` | `{ linkId, from, to }` |
| `connectionDeleted` | `{ linkId }` |
| `requestSpawned` | `{ requestId, type, from }` |
| `requestFinished` | `{ requestId }` |
| `requestFailed` | `{ requestId, reason }` |
| `timeScaleChanged` | `{ scale }` |
| `toolChanged` | `{ toolName }` |
| `budgetWarning` | `{ reason }` |
| `playSound` | `{ soundName }` |

Add new events here before emitting them. Update `docs/DEV_RULES.md` to reference this catalog in the simulation rules section.