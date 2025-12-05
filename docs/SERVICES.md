# Services

This document describes the service catalog model used in Packets of Pain. Services represent network devices and cloud resources that process traffic.

## Service Enums

All service-related enums are defined in `src/config/serviceCatalog.js`.

### SERVICE_KIND

Defines the type of service. Use these values for catalog lookups and type checking.
Values use UPPER_SNAKE_CASE for consistency with TRAFFIC_CLASS.

| Value | Label | Domain | OSI Layer |
|-------|-------|--------|-----------|
| `INTERNET` | Internet | external | 3 |
| `USER` | Home User | external | 7 |
| `MODEM` | Modem | network | 2 |
| `SWITCH` | Switch | network | 2 |
| `FIREWALL` | Firewall | network | 3 |
| `WAF` | Web Application Firewall | cloud | 7 |
| `LOAD_BALANCER` | Load Balancer | cloud | 4 |
| `COMPUTE` | Compute Node | cloud | 7 |
| `DATABASE` | Database | cloud | 7 |
| `OBJECT_STORAGE` | Object Storage | cloud | 7 |

```javascript
const { SERVICE_KIND } = window.ServiceCatalog;

// Usage - values are UPPER_SNAKE for consistency with TRAFFIC_CLASS
const kind = SERVICE_KIND.LOAD_BALANCER;  // 'LOAD_BALANCER'
```

### SERVICE_ROLE

Describes the functional role of a service. Services can have multiple roles.

| Value | Description |
|-------|-------------|
| `ENTRY` | Network ingress point (Internet, Modem) |
| `ROUTING` | Distributes traffic (Switch, Load Balancer) |
| `SECURITY` | Filters traffic (Firewall, WAF) |
| `COMPUTE` | Processes requests (Compute Node) |
| `STORAGE` | Stores data/terminates traffic (Database, Object Storage, User) |

## Service Catalog

The `SERVICE_CATALOG` object in `serviceCatalog.js` contains all service definitions.

### Catalog Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | SERVICE_KIND value (authoritative identifier) |
| `label` | string | Display name for UI |
| `baseCost` | number | Purchase price |
| `upkeepPerTick` | number | Cost per tick (per second / 60) |
| `processingTime` | number | Time in ms to process a request |
| `tiers` | array | Upgrade levels with `{level, capacity, upgradeCost}` |
| `acceptsClasses` | string[] | TRAFFIC_CLASS values this service forwards |
| `terminalClasses` | string[] | TRAFFIC_CLASS values that complete here |
| `blocksClasses` | string[] | TRAFFIC_CLASS values that are blocked |
| `roles` | string[] | SERVICE_ROLE values |
| `osiLayer` | number | OSI model layer (1-7) |
| `serviceDomain` | string | `'network'`, `'cloud'`, or `'external'` |
| `isSecurityDevice` | boolean | True for security-focused devices (only on WAF, Firewall) |
| `category` | string | Legacy: `'device'`, `'cloud'`, or `'external'` |
| `subtitle` | string | Short descriptor for shop UI |
| `icon` | string | Emoji/character fallback |
| `iconPath` | string | Path to SVG icon |
| `tip` | string | Tooltip text for help |
| `drawable` | boolean | False for engine-controlled pseudo-devices |

### Traffic Routing Fields

The three traffic routing fields control how packets flow through services:

```javascript
// Example: WAF entry
{
    kind: 'WAF',
    acceptsClasses: ['WEB', 'API', 'FRAUD'],  // Can process these
    terminalClasses: [],                       // Nothing terminates here
    blocksClasses: ['FRAUD'],                  // Blocks fraud attempts
    // ...
}
```

**Routing Logic:**
1. If traffic class is in `blocksClasses` → **BLOCK** (packet destroyed)
2. If traffic class not in `acceptsClasses` → **DEAD_END** (routing failure)
3. If traffic class is in `terminalClasses` → **TERMINATE** (packet completed)
4. Otherwise → **FORWARD** to next hop

### OSI Layer Reference

| Layer | Name | Services |
|-------|------|----------|
| 1 | Physical | — |
| 2 | Data Link | Modem, Switch |
| 3 | Network | Internet, Firewall |
| 4 | Transport | Load Balancer |
| 5 | Session | — |
| 6 | Presentation | — |
| 7 | Application | User, WAF, Compute, Database, Object Storage |

Display helper:
```javascript
const { getOsiLayerDisplay } = window.ServiceCatalog;
getOsiLayerDisplay(7);  // "Layer 7 (Application)"
```

## Service Definitions

### External Devices (Non-buildable)

#### Internet
```javascript
{
    kind: 'INTERNET',
    label: 'Internet',
    acceptsClasses: [],
    terminalClasses: [],
    blocksClasses: [],
    roles: ['entry'],
    osiLayer: 3,
    serviceDomain: 'external',
    drawable: false
}
```
Engine-controlled spawn point for all traffic.

#### User
```javascript
{
    kind: 'USER',
    label: 'Home User',
    acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
    terminalClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
    blocksClasses: [],
    roles: ['storage'],
    osiLayer: 7,
    serviceDomain: 'external',
    drawable: false
}
```
Campaign endpoint for user-originated traffic. Terminates all incoming traffic.

### Network Devices

#### Modem
```javascript
{
    kind: 'MODEM',
    label: 'Modem',
    baseCost: 25,
    acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
    terminalClasses: [],
    blocksClasses: [],
    roles: ['entry'],
    osiLayer: 2,
    serviceDomain: 'network'
}
```
Entry point from Internet. Connect to firewall or WAF.

#### Switch
```javascript
{
    kind: 'SWITCH',
    label: 'Switch',
    baseCost: 30,
    acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
    terminalClasses: [],
    blocksClasses: [],
    roles: ['routing'],
    osiLayer: 2,
    serviceDomain: 'network'
}
```
Aggregates multiple connections for branching traffic paths.

#### Firewall
```javascript
{
    kind: 'FIREWALL',
    label: 'Firewall',
    baseCost: 75,
    acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
    terminalClasses: [],
    blocksClasses: ['MALICIOUS'],
    roles: ['security'],
    osiLayer: 3,
    serviceDomain: 'network',
    isSecurityDevice: true
}
```
First line of defense. Blocks MALICIOUS traffic.

### Cloud Services

#### WAF (Web Application Firewall)
```javascript
{
    kind: 'WAF',
    label: 'Web Application Firewall',
    baseCost: 50,
    acceptsClasses: ['WEB', 'API', 'FRAUD'],
    terminalClasses: [],
    blocksClasses: ['FRAUD'],
    roles: ['security'],
    osiLayer: 7,
    serviceDomain: 'cloud',
    isSecurityDevice: true
}
```
Application-layer security. Blocks FRAUD traffic.

#### Load Balancer
```javascript
{
    kind: 'LOAD_BALANCER',
    label: 'Load Balancer',
    baseCost: 50,
    acceptsClasses: ['WEB', 'API'],
    terminalClasses: [],
    blocksClasses: [],
    roles: ['routing'],
    osiLayer: 4,
    serviceDomain: 'cloud'
}
```
Distributes traffic to multiple compute nodes.

#### Compute Node
```javascript
{
    kind: 'COMPUTE',
    label: 'Compute Node',
    baseCost: 100,
    acceptsClasses: ['WEB', 'API'],
    terminalClasses: [],
    blocksClasses: [],
    roles: ['compute'],
    osiLayer: 7,
    serviceDomain: 'cloud',
    tiers: [
        { level: 1, capacity: 5, upgradeCost: 0 },
        { level: 2, capacity: 15, upgradeCost: 200 },
        { level: 3, capacity: 25, upgradeCost: 250 }
    ]
}
```
Processes requests. Sets `hasCompute` flag on packets.

#### Database
```javascript
{
    kind: 'DATABASE',
    label: 'Database',
    baseCost: 200,
    acceptsClasses: ['WEB', 'API'],
    terminalClasses: ['API'],
    blocksClasses: [],
    roles: ['storage'],
    osiLayer: 7,
    serviceDomain: 'cloud',
    tiers: [
        { level: 1, capacity: 10, upgradeCost: 0 },
        { level: 2, capacity: 30, upgradeCost: 400 },
        { level: 3, capacity: 50, upgradeCost: 600 }
    ]
}
```
Terminal for API requests. High cost, upgradeable capacity.

#### Object Storage
```javascript
{
    kind: 'OBJECT_STORAGE',
    label: 'Object Storage',
    baseCost: 25,
    acceptsClasses: ['WEB'],
    terminalClasses: ['WEB'],
    blocksClasses: [],
    roles: ['storage'],
    osiLayer: 7,
    serviceDomain: 'cloud'
}
```
Terminal for WEB requests. Low cost, high capacity.

## Service Entity

Services are represented by the `Service` class in `src/entities/Service.js`.

### Constructor

```javascript
const service = new Service(kind, position);
```

**Parameters:**
- `kind` (string): A `SERVICE_KIND` value
- `position` (Object): `{x, y, z}` coordinates

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `svc_abc123`) |
| `kind` | string | SERVICE_KIND value |
| `catalogEntry` | Object | Reference to SERVICE_CATALOG entry |
| `config` | Object | Runtime configuration |
| `position` | Object | `{x, y, z}` coordinates |
| `connections` | array | Connection objects to other services |
| `queue` | array | Packets waiting to be processed |
| `processing` | array | Packets currently being processed |
| `tier` | number | Current upgrade tier (1-based) |
| `load` | Object | Load metrics `{utilization, dropped}` |

### Methods

```javascript
// Upgrade to next tier
service.upgrade(state);

// Process queued packets
service.processQueue(dt);

// Update each tick
service.update(dt);

// Get connected service IDs
const ids = service.getConnectedIds();
```

## API Functions

### getServiceDef(kind)

Get a service definition by kind. Case-insensitive lookup.

```javascript
const { getServiceDef } = window.ServiceCatalog;
const def = getServiceDef('LOAD_BALANCER');  // or 'LoadBalancer', etc.
```

### getCapacityForTier(kind, tierLevel)

Get capacity at a specific tier.

```javascript
const { getCapacityForTier } = window.ServiceCatalog;
const cap = getCapacityForTier('COMPUTE', 2);  // 15
```

### getUpgradeCost(kind, currentTier)

Get cost to upgrade to next tier.

```javascript
const { getUpgradeCost } = window.ServiceCatalog;
const cost = getUpgradeCost('DATABASE', 1);  // 400
```

### canUpgrade(kind)

Check if a service type can be upgraded.

```javascript
const { canUpgrade } = window.ServiceCatalog;
canUpgrade('COMPUTE');  // true
canUpgrade('SWITCH');   // false
```

### getServicesByDomain(domain)

Get all services in a domain.

```javascript
const { getServicesByDomain } = window.ServiceCatalog;
const cloudServices = getServicesByDomain('cloud');
```

### getServicesByRole(role)

Get all services with a specific role.

```javascript
const { getServicesByRole, SERVICE_ROLE } = window.ServiceCatalog;
const securityDevices = getServicesByRole(SERVICE_ROLE.SECURITY);
```

## Testing Notes

Inline `@test` annotations document expected behaviors:

```javascript
/**
 * @test Direct kind lookup should return catalog entry
 * @test Services with SECURITY role should process blocked traffic
 * @test Upgrade should deduct cost and increase capacity
 */
```

## Related Documentation

- [PACKETS.md](PACKETS.md) - Packet model and lifecycle
- [ROUTING.md](ROUTING.md) - STP routing implementation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System overview
