/**
 * serviceCatalog.js - Single source of truth for all service definitions
 * 
 * This file centralizes all service stats including costs, capacities, tiers,
 * traffic routing rules, and display metadata. When balancing the game, modify
 * values here rather than hunting across multiple files.
 * 
 * @module serviceCatalog
 */

/**
 * SERVICE_KIND - Enumeration of all service types
 * Use these values for type checking and catalog lookups.
 * Values use UPPER_SNAKE_CASE for consistency with TRAFFIC_CLASS.
 * 
 * @enum {string}
 * @readonly
 */
const SERVICE_KIND = Object.freeze({
    INTERNET: 'INTERNET',
    USER: 'USER',
    MODEM: 'MODEM',
    SWITCH: 'SWITCH',
    FIREWALL: 'FIREWALL',
    WAF: 'WAF',
    LOAD_BALANCER: 'LOAD_BALANCER',
    COMPUTE: 'COMPUTE',
    DATABASE: 'DATABASE',
    OBJECT_STORAGE: 'OBJECT_STORAGE'
});

/**
 * SERVICE_ROLE - Standard role values for service classification
 * Services can have multiple roles. Used for routing logic and UI.
 * 
 * @enum {string}
 * @readonly
 * 
 * @test Services with SECURITY role should process blocked traffic
 * @test Services with ROUTING role should distribute traffic
 * @test Services with COMPUTE role should set hasCompute flag
 * @test Services with STORAGE role are typically terminals
 * @test Services with ENTRY role are network ingress points
 */
const SERVICE_ROLE = Object.freeze({
    ENTRY: 'entry',
    ROUTING: 'routing',
    SECURITY: 'security',
    COMPUTE: 'compute',
    STORAGE: 'storage'
});

/**
 * SERVICE_CATALOG - Master catalog of all service definitions
 * 
 * Each entry contains:
 * - kind: SERVICE_KIND value (authoritative identifier)
 * - label: Display name for UI
 * - baseCost: Purchase price
 * - upkeepPerTick: Cost per tick (per second / 60)
 * - processingTime: Time in ms to process a request
 * - tiers: Array of upgrade levels with capacity (index 0 = base tier)
 * - acceptsClasses: TRAFFIC_CLASS values this service can process
 * - terminalClasses: TRAFFIC_CLASS values that complete their journey here
 * - blocksClasses: TRAFFIC_CLASS values that are blocked/filtered here
 * - roles: SERVICE_ROLE values describing service function
 * - osiLayer: OSI model layer (1-7) for educational display
 * - serviceDomain: 'network' | 'cloud' | 'external'
 * - isSecurityDevice: true only for security-focused devices (implied false by absence)
 * - category: 'device', 'cloud', or 'external' (legacy, prefer serviceDomain)
 * - subtitle: Short descriptor for shop UI
 * - icon: Emoji/character for shop button
 * - iconPath: Path to SVG icon
 * - tip: Tooltip text for help
 * - drawable: false for engine-controlled pseudo-devices
 */
const SERVICE_CATALOG = {
    // === External / pseudo devices ===
    [SERVICE_KIND.INTERNET]: {
        kind: SERVICE_KIND.INTERNET,
        label: 'Internet',
        baseCost: 0,
        upkeepPerTick: 0,
        processingTime: 0,
        tiers: [{ level: 1, capacity: 25 }],
        acceptsClasses: [],
        terminalClasses: [],
        blocksClasses: [],
        roles: [SERVICE_ROLE.ENTRY],
        osiLayer: 3,
        serviceDomain: 'external',
        category: 'external',
        drawable: false,
        subtitle: 'Edge Cloud',
        icon: '🌐',
        iconPath: 'internet.svg',
        tip: 'Spawn-only pseudo device. Engine-controlled and not buildable.'
    },
    [SERVICE_KIND.USER]: {
        kind: SERVICE_KIND.USER,
        label: 'Home User',
        baseCost: 0,
        upkeepPerTick: 0,
        processingTime: 0,
        tiers: [{ level: 1, capacity: 10 }],
        acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
        terminalClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
        blocksClasses: [],
        roles: [SERVICE_ROLE.STORAGE],
        osiLayer: 7,
        serviceDomain: 'external',
        category: 'external',
        drawable: false,
        subtitle: 'Resident',
        icon: '👤',
        iconPath: 'user.svg',
        tip: 'Static campaign endpoint that can originate requests and receive any returning traffic.'
    },
    
    // === Network Devices ===
    [SERVICE_KIND.MODEM]: {
        kind: SERVICE_KIND.MODEM,
        label: 'Modem',
        baseCost: 25,
        upkeepPerTick: 2,
        processingTime: 50,
        tiers: [{ level: 1, capacity: 200 }],
        acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
        terminalClasses: [],
        blocksClasses: [],
        roles: [SERVICE_ROLE.ENTRY],
        osiLayer: 2,
        serviceDomain: 'network',
        category: 'device',
        subtitle: 'Edge',
        icon: '⌂',
        iconPath: 'modem.svg',
        tip: 'Entry point from the internet. Connect directly to your firewall or WAF.'
    },
    [SERVICE_KIND.SWITCH]: {
        kind: SERVICE_KIND.SWITCH,
        label: 'Switch',
        baseCost: 30,
        upkeepPerTick: 2,
        processingTime: 200,
        tiers: [{ level: 1, capacity: 10 }],
        acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
        terminalClasses: [],
        blocksClasses: [],
        roles: [SERVICE_ROLE.ROUTING],
        osiLayer: 2,
        serviceDomain: 'network',
        category: 'device',
        subtitle: 'Aggregator',
        icon: '⇄',
        iconPath: 'switch.svg',
        tip: 'Aggregates multiple connections. Good for branching traffic to different paths.'
    },
    [SERVICE_KIND.FIREWALL]: {
        kind: SERVICE_KIND.FIREWALL,
        label: 'Firewall',
        baseCost: 75,
        upkeepPerTick: 10,
        processingTime: 50,
        tiers: [{ level: 1, capacity: 20 }],
        acceptsClasses: ['WEB', 'API', 'FRAUD', 'MALICIOUS'],
        terminalClasses: [],
        blocksClasses: ['MALICIOUS'],
        roles: [SERVICE_ROLE.SECURITY],
        osiLayer: 3,
        serviceDomain: 'network',
        isSecurityDevice: true,
        category: 'device',
        subtitle: 'Perimeter',
        icon: '⛨',
        iconPath: 'firewall.svg',
        tip: 'First line of defense. Place near internet entry to block malicious traffic early.'
    },

    // === Cloud Services ===
    [SERVICE_KIND.WAF]: {
        kind: SERVICE_KIND.WAF,
        label: 'Web Application Firewall',
        baseCost: 50,
        upkeepPerTick: 5,
        processingTime: 20,
        tiers: [{ level: 1, capacity: 100 }],
        acceptsClasses: ['WEB', 'API', 'FRAUD'],
        terminalClasses: [],
        blocksClasses: ['FRAUD'],
        roles: [SERVICE_ROLE.SECURITY],
        osiLayer: 7,
        serviceDomain: 'cloud',
        isSecurityDevice: true,
        category: 'cloud',
        subtitle: 'Security',
        icon: '🛡️',
        iconPath: 'waf.svg',
        tip: 'Blocks fraud attempts. Place before compute nodes to protect your backend.'
    },
    [SERVICE_KIND.LOAD_BALANCER]: {
        kind: SERVICE_KIND.LOAD_BALANCER,
        label: 'Load Balancer',
        baseCost: 50,
        upkeepPerTick: 8,
        processingTime: 50,
        tiers: [{ level: 1, capacity: 50 }],
        acceptsClasses: ['WEB', 'API'],
        terminalClasses: [],
        blocksClasses: [],
        roles: [SERVICE_ROLE.ROUTING],
        osiLayer: 4,
        serviceDomain: 'cloud',
        category: 'cloud',
        subtitle: 'Routing',
        icon: '⚙',
        iconPath: 'load_balancer.svg',
        tip: 'Distributes traffic to multiple compute nodes. Essential for scaling under heavy load.'
    },
    [SERVICE_KIND.COMPUTE]: {
        kind: SERVICE_KIND.COMPUTE,
        label: 'Compute Node',
        baseCost: 100,
        upkeepPerTick: 15,
        processingTime: 600,
        tiers: [
            { level: 1, capacity: 5, upgradeCost: 0 },
            { level: 2, capacity: 15, upgradeCost: 200 },
            { level: 3, capacity: 25, upgradeCost: 250 }
        ],
        acceptsClasses: ['WEB', 'API'],
        terminalClasses: [],
        blocksClasses: [],
        roles: [SERVICE_ROLE.COMPUTE],
        osiLayer: 7,
        serviceDomain: 'cloud',
        category: 'cloud',
        subtitle: 'CPU',
        icon: '☐',
        iconPath: 'compute.svg',
        tip: 'Processes requests before storage. Connect between load balancer and database/storage.'
    },
    [SERVICE_KIND.DATABASE]: {
        kind: SERVICE_KIND.DATABASE,
        label: 'Database',
        baseCost: 200,
        upkeepPerTick: 30,
        processingTime: 300,
        tiers: [
            { level: 1, capacity: 10, upgradeCost: 0 },
            { level: 2, capacity: 30, upgradeCost: 400 },
            { level: 3, capacity: 50, upgradeCost: 600 }
        ],
        acceptsClasses: ['WEB', 'API'],
        terminalClasses: ['API'],
        blocksClasses: [],
        roles: [SERVICE_ROLE.STORAGE],
        osiLayer: 7,
        serviceDomain: 'cloud',
        category: 'cloud',
        subtitle: 'Persistence',
        icon: '◯',
        iconPath: 'database.svg',
        tip: 'Terminal for API requests. Ensure compute nodes connect here for API traffic completion.'
    },
    [SERVICE_KIND.OBJECT_STORAGE]: {
        kind: SERVICE_KIND.OBJECT_STORAGE,
        label: 'Object Storage',
        baseCost: 25,
        upkeepPerTick: 5,
        processingTime: 200,
        tiers: [{ level: 1, capacity: 100 }],
        acceptsClasses: ['WEB'],
        terminalClasses: ['WEB'],
        blocksClasses: [],
        roles: [SERVICE_ROLE.STORAGE],
        osiLayer: 7,
        serviceDomain: 'cloud',
        category: 'cloud',
        subtitle: 'Files',
        icon: '⬡',
        iconPath: 'object_storage.svg',
        tip: 'Terminal for WEB requests. Low cost, high capacity. Place after compute for web traffic.'
    }
};

/**
 * Get service definition by kind
 * 
 * @param {string} kind - SERVICE_KIND value (case-insensitive)
 * @returns {Object|null} Service definition or null if not found
 * 
 * @test Direct kind lookup (UPPER_SNAKE) should return catalog entry
 * @test Case-insensitive lookup should work (e.g., 'User' -> 'USER')
 */
function getServiceDef(kind) {
    if (!kind) return null;
    
    // Direct lookup by kind
    if (SERVICE_CATALOG[kind]) {
        return SERVICE_CATALOG[kind];
    }
    
    // Try UPPER_SNAKE version (normalize case)
    const upperKind = kind.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2');
    if (SERVICE_CATALOG[upperKind]) {
        return SERVICE_CATALOG[upperKind];
    }
    
    // Try SERVICE_KIND enum mapping
    const mappedKind = SERVICE_KIND[upperKind];
    if (mappedKind && SERVICE_CATALOG[mappedKind]) {
        return SERVICE_CATALOG[mappedKind];
    }
    
    return null;
}

/**
 * Get capacity for a service at a specific tier level
 * 
 * @param {string} kind - SERVICE_KIND value
 * @param {number} tierLevel - Tier level (1-based)
 * @returns {number} Capacity at that tier
 */
function getCapacityForTier(kind, tierLevel = 1) {
    const def = getServiceDef(kind);
    if (!def) return 1;
    
    const tierIndex = tierLevel - 1;
    if (tierIndex >= 0 && tierIndex < def.tiers.length) {
        return def.tiers[tierIndex].capacity;
    }
    return def.tiers[0]?.capacity || 1;
}

/**
 * Get upgrade cost for next tier
 * 
 * @param {string} kind - SERVICE_KIND value
 * @param {number} currentTier - Current tier level (1-based)
 * @returns {number|null} Upgrade cost or null if at max tier
 */
function getUpgradeCost(kind, currentTier) {
    const def = getServiceDef(kind);
    if (!def) return null;
    
    const nextTierIndex = currentTier;
    if (nextTierIndex < def.tiers.length) {
        return def.tiers[nextTierIndex].upgradeCost ?? null;
    }
    return null;
}

/**
 * Check if a service can be upgraded
 * 
 * @param {string} kind - SERVICE_KIND value
 * @returns {boolean} True if service has multiple tiers
 */
function canUpgrade(kind) {
    const def = getServiceDef(kind);
    return def && def.tiers.length > 1;
}

/**
 * Ordered list of service kinds for shop display
 */
const SHOP_ORDER = [
    SERVICE_KIND.MODEM,
    SERVICE_KIND.FIREWALL,
    SERVICE_KIND.SWITCH,
    SERVICE_KIND.WAF,
    SERVICE_KIND.LOAD_BALANCER,
    SERVICE_KIND.COMPUTE,
    SERVICE_KIND.DATABASE,
    SERVICE_KIND.OBJECT_STORAGE
];

/**
 * Get all service kinds
 * 
 * @returns {string[]} Array of SERVICE_KIND values
 */
function getAllServiceKinds() {
    return Object.values(SERVICE_KIND);
}

/**
 * Get services by domain
 * 
 * @param {string} domain - 'network', 'cloud', or 'external'
 * @returns {Object[]} Array of service definitions
 */
function getServicesByDomain(domain) {
    return Object.values(SERVICE_CATALOG).filter(s => s.serviceDomain === domain);
}

/**
 * Get services by role
 * 
 * @param {string} role - SERVICE_ROLE value
 * @returns {Object[]} Array of service definitions
 */
function getServicesByRole(role) {
    return Object.values(SERVICE_CATALOG).filter(s => s.roles?.includes(role));
}

/**
 * OSI Layer names for display
 */
const OSI_LAYER_NAMES = Object.freeze({
    1: 'Physical',
    2: 'Data Link',
    3: 'Network',
    4: 'Transport',
    5: 'Session',
    6: 'Presentation',
    7: 'Application'
});

/**
 * Get OSI layer display string
 * 
 * @param {number} layer - OSI layer number (1-7)
 * @returns {string} Formatted string like "Layer 7 (Application)"
 */
function getOsiLayerDisplay(layer) {
    const name = OSI_LAYER_NAMES[layer];
    return name ? `Layer ${layer} (${name})` : `Layer ${layer}`;
}

/**
 * @deprecated Use getServiceDef instead
 */
function getServiceType(key) {
    return getServiceDef(key);
}

/**
 * @deprecated Use getServicesByDomain instead
 */
function getServicesByCategory(category) {
    const domainMap = { device: 'network', cloud: 'cloud', external: 'external' };
    const domain = domainMap[category] || category;
    return getServicesByDomain(domain);
}

/**
 * @deprecated Use getAllServiceKinds instead
 */
function getAllServiceKeys() {
    return getAllServiceKinds();
}

// Expose globally for non-module scripts
if (typeof window !== 'undefined') {
    window.SERVICE_KIND = SERVICE_KIND;
    window.SERVICE_ROLE = SERVICE_ROLE;
    window.SERVICE_CATALOG = SERVICE_CATALOG;
    window.OSI_LAYER_NAMES = OSI_LAYER_NAMES;
    window.ServiceCatalog = {
        SERVICE_KIND,
        SERVICE_ROLE,
        SERVICE_CATALOG,
        SHOP_ORDER,
        OSI_LAYER_NAMES,
        getServiceDef,
        getCapacityForTier,
        getUpgradeCost,
        canUpgrade,
        getAllServiceKinds,
        getServicesByDomain,
        getServicesByRole,
        getOsiLayerDisplay
    };
}