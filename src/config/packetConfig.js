/**
 * packetConfig.js - Packet configuration and enums
 * 
 * Single source of truth for packet-related enums, constants, and color mappings.
 * Separates traffic classification from packet lifecycle phase and flow direction.
 * 
 * @module packetConfig
 */

/**
 * TRAFFIC_CLASS - What the packet represents (its payload/purpose)
 * Used for routing decisions, terminal matching, and blocking rules.
 * 
 * @enum {string}
 * @readonly
 * 
 * @test WEB packets should route to objectStorage terminals
 * @test API packets should route to database terminals
 * @test FRAUD packets should be blocked by WAF
 * @test MALICIOUS packets should be blocked by Firewall
 */
export const TRAFFIC_CLASS = Object.freeze({
    WEB: 'WEB',
    API: 'API',
    FRAUD: 'FRAUD',
    MALICIOUS: 'MALICIOUS'
});

/**
 * PACKET_PHASE - Where in the request/response cycle the packet is
 * Drives state transitions and response generation.
 * 
 * @enum {string}
 * @readonly
 * 
 * @test REQUEST phase packets completing at terminal should spawn RESPONSE phase packets
 * @test RESPONSE phase packets should route back to origin (user node)
 * @test Phase should not affect routing decisions for traffic class
 */
export const PACKET_PHASE = Object.freeze({
    REQUEST: 'REQUEST',
    RESPONSE: 'RESPONSE'
});

/**
 * FLOW_DIRECTION - Network flow direction (optional, for future use)
 * May be used in tutorials or advanced mechanics to distinguish traffic origin.
 * 
 * @enum {string}
 * @readonly
 */
export const FLOW_DIRECTION = Object.freeze({
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND'
});

/**
 * PACKET_DEATH_REASON - Why a packet was removed from simulation
 * Used for debugging, analytics, and UI feedback.
 * 
 * @enum {string}
 * @readonly
 * 
 * @test BLOCKED should be set when packet hits a service with blocksClasses match
 * @test TERMINATED should be set when packet reaches terminal successfully
 * @test TTL_EXPIRED should be set when hopCount exceeds MAX_HOPS
 * @test NO_ROUTE should be set when no valid next hop exists
 * @test CAPACITY_OVERFLOW should be set when service queue rejects packet
 */
export const PACKET_DEATH_REASON = Object.freeze({
    BLOCKED: 'BLOCKED',
    TERMINATED: 'TERMINATED',
    TTL_EXPIRED: 'TTL_EXPIRED',
    NO_ROUTE: 'NO_ROUTE',
    CAPACITY_OVERFLOW: 'CAPACITY_OVERFLOW'
});

/**
 * Maximum hops before packet is dropped (TTL limit)
 * @constant {number}
 */
export const MAX_HOPS = 16;

/**
 * Packet color mappings by TRAFFIC_CLASS
 * All packet rendering should reference these values.
 * 
 * @type {Object.<string, number>}
 */
export const PACKET_COLORS = Object.freeze({
    [TRAFFIC_CLASS.WEB]: 0x4ade80,      // Green
    [TRAFFIC_CLASS.API]: 0xffa500,      // Orange
    [TRAFFIC_CLASS.FRAUD]: 0xff00ff,    // Pink/Magenta
    [TRAFFIC_CLASS.MALICIOUS]: 0xff0000 // Red
});

/**
 * Color for failed/dead packets
 * @constant {number}
 */
export const PACKET_FAIL_COLOR = 0xef4444;

/**
 * Get color for a traffic class
 * @param {string} trafficClass - A TRAFFIC_CLASS value
 * @returns {number} Hex color value
 */
export function getPacketColor(trafficClass) {
    return PACKET_COLORS[trafficClass] ?? PACKET_FAIL_COLOR;
}
