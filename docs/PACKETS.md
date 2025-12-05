# Packets

This document describes the packet model used in Packets of Pain. Packets represent network traffic flowing through the player's infrastructure.

## Packet Enums

All packet-related enums are defined in `src/config/packetConfig.js`.

### TRAFFIC_CLASS

Defines the type of traffic a packet represents.

| Value | Description | Color | Scoring |
|-------|-------------|-------|---------|
| `WEB` | Web browser requests | Blue (#00aaff) | +10 score, +$5 reward |
| `API` | API/backend calls | Green (#00ff88) | +20 score, +$10 reward |
| `FRAUD` | Fraudulent attempts | Orange (#ff9900) | Should be blocked by WAF |
| `MALICIOUS` | Attack traffic | Red (#ff0000) | Should be blocked by Firewall |

```javascript
import { TRAFFIC_CLASS } from '../config/packetConfig.js';

// Usage
const trafficClass = TRAFFIC_CLASS.WEB;  // 'WEB'
```

### PACKET_PHASE

Tracks the lifecycle phase of a packet.

| Value | Description |
|-------|-------------|
| `REQUEST` | Outbound request traveling from source to terminal |
| `RESPONSE` | Return traffic traveling back to origin |

Response packets inherit the original `trafficClass` but change `phase` to `RESPONSE`.

### FLOW_DIRECTION

Describes the direction of packet flow relative to the user.

| Value | Description |
|-------|-------------|
| `INBOUND` | Traffic coming from external sources toward user |
| `OUTBOUND` | Traffic going from user to external services |

### PACKET_DEATH_REASON

Records why a packet was destroyed.

| Value | Description |
|-------|-------------|
| `BLOCKED` | Filtered by security device (WAF, Firewall) |
| `TERMINATED` | Successfully reached terminal node |
| `TTL_EXPIRED` | Exceeded MAX_HOPS (16) |
| `NO_ROUTE` | No valid path to destination |
| `CAPACITY_OVERFLOW` | Dropped due to queue overflow |

## Constants

### MAX_HOPS

Maximum number of hops a packet can take before TTL expiration.

```javascript
const MAX_HOPS = 16;  // Matches standard network TTL behavior
```

### PACKET_COLORS

Map of traffic classes to hex colors for rendering.

```javascript
const PACKET_COLORS = {
    WEB: 0x00aaff,       // Blue
    API: 0x00ff88,       // Green
    FRAUD: 0xff9900,     // Orange
    MALICIOUS: 0xff0000, // Red
    RESPONSE: 0xffffff   // White (for response phase)
};
```

## Request Entity

Packets are represented by the `Request` class in `src/entities/Request.js`.

### Constructor

```javascript
const request = new Request(trafficClass, originPosition, options);
```

**Parameters:**
- `trafficClass` (string): A `TRAFFIC_CLASS` value
- `originPosition` (Object): `{x, y, z}` starting coordinates
- `options` (Object, optional):
  - `phase`: `PACKET_PHASE` value (default: `REQUEST`)
  - `responseOrigin`: `{sourceId, targetUserId}` for response routing

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `req_abc123`) |
| `trafficClass` | string | TRAFFIC_CLASS value |
| `phase` | string | PACKET_PHASE value |
| `position` | Object | Current `{x, y, z}` coordinates |
| `path` | string[] | Node IDs visited (uncapped, for debugging) |
| `hops` | number | TTL counter (packet dies at MAX_HOPS) |
| `lastNodeId` | string | ID of last node visited |
| `hasCompute` | boolean | True after passing through compute node |
| `deathReason` | string | PACKET_DEATH_REASON when destroyed |
| `responseOrigin` | Object | `{sourceId, targetUserId}` for responses |

### Methods

```javascript
// Move packet to next node (increments hops, records to path)
request.flyTo(targetNode);

// Update position during flight
request.update(deltaTime);

// Set death reason
request.deathReason = PACKET_DEATH_REASON.BLOCKED;
```

## Packet Lifecycle

```
1. SPAWN
   └── traffic.js creates Request with trafficClass and phase=REQUEST
   └── Emits 'requestSpawned' event

2. ROUTING
   └── Request queued at first service node
   └── Service processes request, calls routing.getNextHop()
   └── Routing evaluates: BLOCK → TERMINATE → FORWARD → DEAD_END

3. MOVEMENT
   └── Request.flyTo(nextNode) updates position
   └── Path array updated (capped at MAX_HOPS)
   └── requestManager.js updates mesh position

4. COMPLETION
   └── TERMINATE: Request reaches terminal node
      └── Score updated, response spawned if user-originated
      └── Emits 'requestFinished' event
   └── BLOCK: Security device blocks traffic
      └── Score updated for fraud blocked
      └── Emits 'requestFailed' event
   └── DEAD_END / TTL: Request fails
      └── Reputation penalty applied
      └── Emits 'requestFailed' event

5. CLEANUP
   └── Request removed from simulation.requests
   └── Mesh disposed by requestManager.js
```

## Response Packets

When a WEB or API request from a user reaches its terminal:

1. `spawnInboundResponse()` creates a new Request with:
   - Same `trafficClass` as original
   - `phase: PACKET_PHASE.RESPONSE`
   - `responseOrigin: { sourceId: 'internet', targetUserId: userService.id }`

2. Response routes back through the network toward the user

3. User node terminates response packets (has them in `terminalClasses`)

## Color Rendering

Colors are applied in `requestManager.js`:

```javascript
import { getPacketColor } from '../config/packetConfig.js';

// Get color for any traffic class
const color = getPacketColor('WEB');  // Returns 0x00aaff

// getPacketColor handles responses specially
const responseColor = getPacketColor('WEB', { isResponse: true }); // White
```

## Testing Notes

Inline `@test` annotations document expected behaviors:

```javascript
/**
 * @test trafficClass should be set from constructor
 * @test Legacy type getter should return trafficClass value
 * @test Path should be capped at MAX_HOPS entries
 * @test Response packets should have phase=RESPONSE
 */
```

These serve as documentation for future test implementation.

## Related Documentation

- [SERVICES.md](SERVICES.md) - Service catalog and routing rules
- [ROUTING.md](ROUTING.md) - STP routing implementation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System overview
