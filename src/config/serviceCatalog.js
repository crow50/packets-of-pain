/**
 * serviceCatalog.js - Single source of truth for all service definitions
 * 
 * This file centralizes all service stats including costs, capacities, tiers,
 * traffic routing rules, and display metadata. When balancing the game, modify
 * values here rather than hunting across multiple files.
 * 
 */

/**
 * SERVICE_TYPES - Master catalog of all placeable services
 * 
 * Each entry contains:
 * - key: Internal identifier (matches object key)
 * - label: Display name for UI
 * - baseCost: Purchase price
 * - upkeepPerTick: Cost per tick (per second / 60)
 * - processingTime: Time in ms to process a request
 * - tiers: Array of upgrade levels with capacity (index 0 = base tier)
 * - accepts: Traffic types this service can process
 * - terminalFor: Traffic types that complete their journey here
 * - blocks: Traffic types that are blocked/filtered here
 * - category: 'device' for network gear, 'cloud' for cloud services
 * - subtitle: Short descriptor for shop UI
 * - icon: Emoji/character for shop button
 */
const SERVICE_TYPES = {
    // === External / pseudo devices ===
    INTERNET: {
        key: 'INTERNET',
        label: 'Internet',
        baseCost: 0,
        upkeepPerTick: 0,
        processingTime: 0,
        tiers: [
            { level: 1, capacity: 25 }
        ],
        accepts: [],
        terminalFor: [],
        blocks: [],
        category: 'external',
        drawable: false,
        subtitle: 'Edge Cloud',
        icon: '🌐',
        tip: 'Spawn-only pseudo device. Engine-controlled and not buildable.'
    },
    USER: {
        key: 'user',
        label: 'Home User',
        baseCost: 0,
        upkeepPerTick: 0,
        processingTime: 0,
        tiers: [
            { level: 1, capacity: 10 }
        ],
        accepts: ['RESPONSE', 'INBOUND', 'FRAUD', 'MALICIOUS'],
        terminalFor: ['RESPONSE', 'INBOUND', 'FRAUD', 'MALICIOUS'],
        blocks: [],
        category: 'external',
        drawable: false,
        subtitle: 'Resident',
        icon: '👤',
        tip: 'Static campaign endpoint that can originate requests and receive any returning traffic.'
    },
    // === Generic Network Devices ===
    MODEM: {
        key: 'modem',
        label: 'Modem',
        baseCost: 25,
        upkeepPerTick: 2,
        processingTime: 50,
        tiers: [
            { level: 1, capacity: 200 }
        ],
        accepts: ['WEB', 'API', 'FRAUD', 'MALICIOUS', 'INBOUND'],
        terminalFor: [],
        blocks: [],
        category: 'device',
        subtitle: 'Edge',
        icon: '⌂',
        tip: 'Entry point from the internet. Connect directly to your firewall or WAF.'
    },
    SWITCH: {
        key: 'switch',
        label: 'Switch',
        baseCost: 30,
        upkeepPerTick: 2,
        processingTime: 200,
        tiers: [
            { level: 1, capacity: 10 }
        ],
        accepts: ['WEB', 'API', 'FRAUD', 'MALICIOUS', 'INBOUND'],
        terminalFor: [],
        blocks: [],
        category: 'device',
        subtitle: 'Aggregator',
        icon: '⇄',
        tip: 'Aggregates multiple connections. Good for branching traffic to different paths.'
    },
    FIREWALL: {
        key: 'firewall',
        label: 'Firewall',
        baseCost: 75,
        upkeepPerTick: 10,
        processingTime: 50,
        tiers: [
            { level: 1, capacity: 20 }
        ],
        accepts: ['WEB', 'API', 'FRAUD', 'MALICIOUS', 'INBOUND'],
        terminalFor: [],
        blocks: ['MALICIOUS'],
        category: 'device',
        subtitle: 'Perimeter',
        icon: '⛨',
        tip: 'First line of defense. Place near internet entry to block malicious traffic early.'
    },

    // === Cloud Services ===
    WAF: {
        key: 'waf',
        label: 'Web Application Firewall',
        baseCost: 50,
        upkeepPerTick: 5,
        processingTime: 20,
        tiers: [
            { level: 1, capacity: 100 }
        ],
        accepts: ['WEB', 'API', 'FRAUD', 'INBOUND'],
        terminalFor: [],
        blocks: ['FRAUD'],
        category: 'cloud',
        subtitle: 'Security',
        icon: '🛡️',
        tip: 'Blocks fraud attempts. Place before compute nodes to protect your backend.'
    },
    LOAD_BALANCER: {
        key: 'loadBalancer',
        label: 'Load Balancer',
        baseCost: 50,
        upkeepPerTick: 8,
        processingTime: 50,
        tiers: [
            { level: 1, capacity: 50 }
        ],
        accepts: ['WEB', 'API', 'INBOUND'],
        terminalFor: [],
        blocks: [],
        category: 'cloud',
        subtitle: 'Routing',
        icon: '⚙',
        tip: 'Distributes traffic to multiple compute nodes. Essential for scaling under heavy load.'
    },
    COMPUTE: {
        key: 'compute',
        label: 'Compute Node',
        baseCost: 100,
        upkeepPerTick: 15,
        processingTime: 600,
        tiers: [
            { level: 1, capacity: 5, upgradeCost: 0 },
            { level: 2, capacity: 15, upgradeCost: 200 },
            { level: 3, capacity: 25, upgradeCost: 250 }
        ],
        accepts: ['WEB', 'API', 'INBOUND'],
        terminalFor: [],
        blocks: [],
        category: 'cloud',
        subtitle: 'CPU',
        icon: '☐',
        tip: 'Processes requests before storage. Connect between load balancer and database/storage.'
    },
    DATABASE: {
        key: 'database',
        label: 'Database',
        baseCost: 200,
        upkeepPerTick: 30,
        processingTime: 300,
        tiers: [
            { level: 1, capacity: 10, upgradeCost: 0 },
            { level: 2, capacity: 30, upgradeCost: 400 },
            { level: 3, capacity: 50, upgradeCost: 600 }
        ],
        accepts: ['WEB', 'API', 'INBOUND'],
        terminalFor: ['API'],
        blocks: [],
        category: 'cloud',
        subtitle: 'Persistence',
        icon: '◯',
        tip: 'Terminal for API requests. Ensure compute nodes connect here for API traffic completion.'
    },
    OBJECT_STORAGE: {
        key: 'objectStorage',
        label: 'Object Storage',
        baseCost: 25,
        upkeepPerTick: 5,
        processingTime: 200,
        tiers: [
            { level: 1, capacity: 100 }
        ],
        accepts: ['WEB', 'INBOUND'],
        terminalFor: ['WEB'],
        blocks: [],
        category: 'cloud',
        subtitle: 'Files',
        icon: '⬡',
        tip: 'Terminal for WEB requests. Low cost, high capacity. Place after compute for web traffic.'
    }
};

/**
 * Helper to get service type config by key (case-insensitive)
 * Supports both UPPER_CASE catalog keys and lowercase runtime keys
 */
function getServiceType(key) {
    if (!key) return null;
    
    // Direct match on uppercase key
    const upperKey = key.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2');
    if (SERVICE_TYPES[upperKey]) {
        return SERVICE_TYPES[upperKey];
    }
    
    // Search by runtime key
    const entry = Object.values(SERVICE_TYPES).find(s => s.key === key);
    return entry || null;
}

/**
 * Get capacity for a service at a specific tier level
 */
function getCapacityForTier(key, tierLevel = 1) {
    const serviceType = getServiceType(key);
    if (!serviceType) return 1;
    
    const tierIndex = tierLevel - 1;
    if (tierIndex >= 0 && tierIndex < serviceType.tiers.length) {
        return serviceType.tiers[tierIndex].capacity;
    }
    return serviceType.tiers[0]?.capacity || 1;
}

/**
 * Get upgrade cost for next tier
 */
function getUpgradeCost(key, currentTier) {
    const serviceType = getServiceType(key);
    if (!serviceType) return null;
    
    const nextTierIndex = currentTier; // currentTier is 1-based, so index for next is currentTier
    if (nextTierIndex < serviceType.tiers.length) {
        return serviceType.tiers[nextTierIndex].upgradeCost ?? null;
    }
    return null; // Already at max tier
}

/**
 * Check if a service can be upgraded
 */
function canUpgrade(key) {
    const serviceType = getServiceType(key);
    return serviceType && serviceType.tiers.length > 1;
}

/**
 * Ordered list of service keys for shop display
 */
const SHOP_ORDER = [
    'modem', 'firewall', 'switch', 'waf', 'loadBalancer', 'compute', 'database', 'objectStorage'
];

/**
 * Get all service keys
 */
function getAllServiceKeys() {
    return Object.values(SERVICE_TYPES).map(s => s.key);
}

/**
 * Get services by category
 */
function getServicesByCategory(category) {
    return Object.values(SERVICE_TYPES).filter(s => s.category === category);
}

// Expose globally for non-module scripts
if (typeof window !== 'undefined') {
    window.ServiceCatalog = {
        SERVICE_TYPES,
        getServiceType,
        getCapacityForTier,
        getUpgradeCost,
        canUpgrade,
        SHOP_ORDER,
        getAllServiceKeys,
        getServicesByCategory
    };
}
