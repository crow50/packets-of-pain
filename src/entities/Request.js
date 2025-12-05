import { copyPosition, toPlainPosition } from "../sim/vectorUtils.js";
import { TRAFFIC_CLASS, PACKET_PHASE, PACKET_DEATH_REASON, MAX_HOPS } from "../config/packetConfig.js";

/**
 * @typedef {Object} ResponseOrigin
 * @property {string} nodeId - ID of the node that should receive the response
 * @property {string} nodeType - Type of the originating node (e.g., 'user')
 */

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

const DEFAULT_HEIGHT = 2;

function clonePosition(source) {
    const base = toPlainPosition(source);
    base.y = DEFAULT_HEIGHT;
    return base;
}

/**
 * Request - Represents a packet moving through the network
 * 
 * Lifecycle: spawn → route → process → terminate
 * 
 * @class
 * 
 * @test TTL enforcement: packet with hops > MAX_HOPS should be dropped with TTL_EXPIRED
 * @test Phase transition: REQUEST completing at terminal should allow RESPONSE spawn
 * @test Routing: trafficClass determines terminal matching and blocking
 * @test Path tracking: path array records node IDs visited (capped at MAX_HOPS)
 */
class Request {
    /**
     * Create a new packet request
     * 
     * @param {string} trafficClass - TRAFFIC_CLASS value (WEB, API, FRAUD, MALICIOUS)
     * @param {Object} [originPosition] - Starting position {x, y, z}
     * @param {Object} [options] - Additional options
     * @param {string} [options.phase] - PACKET_PHASE value (defaults to REQUEST)
     * @param {ResponseOrigin} [options.responseOrigin] - For RESPONSE phase, where to route back
     */
    constructor(trafficClass, originPosition, options = {}) {
        this.id = Math.random().toString(36);
        this.value = 10;
        
        // Traffic classification (replaces legacy 'type')
        this.trafficClass = trafficClass;
        
        // Lifecycle phase (replaces legacy 'isResponse' flag)
        this.phase = options.phase || PACKET_PHASE.REQUEST;
        
        // Response tracking (consolidates sourceId, sourceType, targetUserId)
        // Only set for RESPONSE phase packets or REQUEST packets from user nodes
        this.responseOrigin = options.responseOrigin || null;

        const internetNode = getEngine()?.getSimulation()?.internetNode;
        const spawnSource = originPosition || internetNode?.position;
        const startPos = clonePosition(spawnSource);

        this.position = { ...startPos };
        this.origin = { ...startPos };

        this.target = null;
        this.progress = 0;
        this.isMoving = false;
        
        // Hop tracking (TTL enforcement)
        this.hops = 0;
        this.path = [];
        this._ttlFailed = false;
        
        // Processing state
        this.hasCompute = false;
        this.lastNodeId = null;
        
        // Death tracking for analytics/debugging
        this.deathReason = null;
    }

    /**
     * Initiate flight to next hop service
     * 
     * @param {Object} service - Target service node
     * 
     * @test Path should record service.id (uncapped for debugging)
     * @test Hops should increment (TTL counter)
     * @test TTL check happens in update(), not here
     */
    flyTo(service) {
        if (!service) return;
        copyPosition(this.origin, this.position);
        this.target = service;
        this.progress = 0;
        this.isMoving = true;
        this.hops += 1;
        
        // Path is uncapped - useful for debugging routing
        // TTL enforcement uses hops counter, checked in update()
        this.path.push(service.id);
    }

    /**
     * Update packet position and handle arrival
     * 
     * @param {number} dt - Delta time in seconds
     * 
     * @test TTL exceeded should trigger failRequest with TTL_EXPIRED
     * @test Arrival at full queue should trigger failRequest with CAPACITY_OVERFLOW
     * @test Successful arrival should add packet to service queue
     */
    update(dt) {
        if (this.hops > MAX_HOPS) {
            if (!this._ttlFailed) {
                this._ttlFailed = true;
                this.deathReason = PACKET_DEATH_REASON.TTL_EXPIRED;
                failRequest(this);
            }
            return;
        }

        if (this.isMoving && this.target) {
            this.progress += dt * 2;
            if (this.progress >= 1) {
                this.progress = 1;
                this.isMoving = false;
                copyPosition(this.position, this.target.position ?? this.position);
                this.position.y = DEFAULT_HEIGHT;

                const node = this.target;
                if (!node || !Array.isArray(node.queue) || node.queue.length >= 20) {
                    this.deathReason = PACKET_DEATH_REASON.CAPACITY_OVERFLOW;
                    failRequest(this);
                } else {
                    node.queue.push(this);
                }
            } else {
                const dest = clonePosition(this.target.position);
                const t = Math.min(1, this.progress);
                this.position.x = this.origin.x + (dest.x - this.origin.x) * t;
                this.position.z = this.origin.z + (dest.z - this.origin.z) * t;
                const baseY = this.origin.y + (dest.y - this.origin.y) * t;
                this.position.y = baseY + Math.sin(t * Math.PI) * 2;
            }
        }
    }

    /**
     * Clean up packet state
     */
    destroy() {
        this.target = null;
        this.isMoving = false;
        this.path.length = 0;
        this.responseOrigin = null;
    }
}

export default Request;
