/**
 * Service.js - Service node entity for network topology
 * 
 * Represents a buildable or engine-controlled device in the network.
 * Uses SERVICE_KIND values from serviceCatalog.js for type identification.
 * 
 * @module Service
 */

import { copyPosition, toPosition } from "../sim/vectorUtils.js";
import { flashMoney } from "../sim/tools.js";
import { getServiceDef, getCapacityForTier, getUpgradeCost, canUpgrade, SERVICE_KIND, SERVICE_ROLE } from "../config/serviceCatalog.js";
import { getConnectionTargets, upgradeConnectionFormat } from "../sim/connectionUtils.js";
import { getNextHop, isBlocked } from "../core/routing.js";
import { updateScore, removeRequest, failRequest, finishRequest, calculateFailChanceBasedOnLoad } from "../sim/traffic.js";
import { getRuntimeEngine } from "../utils/runtime.js";

const normalizeConnections = upgradeConnectionFormat || function(service) {
    if (!service) return [];
    if (!Array.isArray(service.connections)) {
        service.connections = [];
    }
    return service.connections;
};

/**
 * Check if a catalog entry has a specific role
 * @param {Object} catalogEntry - Catalog entry from getServiceDef()
 * @param {string} role - SERVICE_ROLE value to check
 * @returns {boolean}
 */
function hasRole(catalogEntry, role) {
    return Array.isArray(catalogEntry?.roles) && catalogEntry.roles.includes(role);
}

/**
 * Check if a service is a security device (WAF/Firewall)
 * @param {Object} catalogEntry - Catalog entry from getServiceDef()
 * @returns {boolean}
 */
function isSecurityDevice(catalogEntry) {
    return catalogEntry?.isSecurityDevice === true;
}

const getEngine = () => getRuntimeEngine();

function emit(event, payload) {
    const engine = getEngine();
    engine?.emit?.(event, payload);
}

/**
 * Service - Network node entity
 * 
 * @param {string} kind - SERVICE_KIND value (e.g., 'LOAD_BALANCER', 'COMPUTE')
 * @param {Object|{x,y}} pos - Position object or {x, y} coordinates
 * 
 * @test Constructor should accept SERVICE_KIND values directly
 * @test Catalog entry should resolve via getServiceDef()
 * @test Invalid kind should create service with sensible defaults
 */
class Service {
    constructor(kind, pos) {
        this.id = 'svc_' + Math.random().toString(36).substr(2, 9);
        
        // Store the kind (SERVICE_KIND value)
        this.kind = kind;
        
        // Look up catalog entry using new API
        this.catalogEntry = getServiceDef(kind);
        
        this.config = {
            name: this.catalogEntry?.label || kind,
            cost: this.catalogEntry?.baseCost ?? 0,
            kind: this.catalogEntry?.kind || kind,
            processingTime: this.catalogEntry?.processingTime || 100,
            capacity: getCapacityForTier(kind, 1),
            upkeep: this.catalogEntry?.upkeepPerTick || 0
        };
        
        this.position = toPosition(pos);
        this.queue = [];
        this.processing = [];
        this.connections = [];
        this.tier = 1;
        this.load = {
            lastTickProcessed: 0,
            lastTickCapacity: this.config.capacity,
            utilization: 0,
            dropped: 0
        };
    }

    /**
     * Upgrade service to next tier
     * 
     * @param {Object} state - Game state with simulation.money
     * 
     * @test Should deduct upgrade cost from money
     * @test Should increase tier and capacity
     * @test Should emit serviceUpgraded and playSound events
     * @test Should flash money and abort if insufficient funds
     */
    upgrade(state) {
        if (!canUpgrade(this.kind)) return;
        const sim = state.simulation;
        const upgradeCost = getUpgradeCost(this.kind, this.tier);
        if (upgradeCost === null) return;
        if (sim.money < upgradeCost) {
            flashMoney();
            return;
        }

        sim.money -= upgradeCost;
        this.tier += 1;
        this.config.capacity = getCapacityForTier(this.kind, this.tier);
        this.load.lastTickCapacity = this.config.capacity;
        emit('serviceUpgraded', { serviceId: this.id, tier: this.tier });
        emit('playSound', { soundName: 'upgrade' });
    }

    /**
     * Process queued requests through this service
     * 
     * @param {number} dt - Delta time in seconds
     * 
     * @test Should process up to capacity requests per second
     * @test Should block traffic matching catalogEntry.blocksClasses
     * @test Should overflow and drop when queue exceeds 3x capacity
     * @test Compute role services should mark hasCompute on requests
     * @test Security devices (isSecurityDevice=true) should get priority blocking check
     */
    processQueue(dt) {
        const capacityPerSec = this.config.capacity;
        const maxToProcess = Math.max(1, Math.floor(capacityPerSec * dt));
        let processed = 0;
        
        // Check if this is a compute role service
        const isComputeService = this.kind === SERVICE_KIND.COMPUTE || hasRole(this.catalogEntry, SERVICE_ROLE.COMPUTE);

        while (processed < maxToProcess && this.processing.length < capacityPerSec && this.queue.length > 0) {
            const req = this.queue.shift();
            const trafficClass = req.trafficClass;
            
            if (isBlocked(this.catalogEntry, trafficClass)) {
                updateScore(req, 'FRAUD_BLOCKED');
                removeRequest(req);
                processed++;
                continue;
            }

            // Compute services skip processing if already computed
            if (isComputeService && req.hasCompute) {
                this.processing.push({ req, timer: this.config.processingTime });
                processed++;
                continue;
            }

            this.processing.push({ req, timer: 0 });
            processed++;
        }

        this.load.lastTickProcessed = processed;
        this.load.lastTickCapacity = maxToProcess;

        const maxQueueSize = capacityPerSec * 3;
        if (this.queue.length > maxQueueSize) {
            const overflow = this.queue.length - maxQueueSize;
            const sim = getEngine()?.getSimulation();
            for (let i = 0; i < overflow; i++) {
                const dropped = this.queue.shift();
                if (dropped) {
                    this.load.dropped++;
                    if (sim?.metrics?.droppedByReason) {
                        sim.metrics.droppedByReason.overload = (sim.metrics.droppedByReason.overload || 0) + 1;
                    }
                    if (sim) {
                        sim.reputation = Math.max(0, sim.reputation - 0.5);
                    }
                    removeRequest(dropped);
                }
            }
        }
    }

    /**
     * Update service state each tick
     * 
     * @param {number} dt - Delta time in seconds
     * 
     * @test Should deduct upkeep from money
     * @test Should update load utilization
     * @test Should route completed requests via Routing.getNextHop()
     * @test Should fail requests that reach dead ends
     * @test Routing role services (load balancers) should not fail requests
     * @test Terminal services (terminalClasses match) should finishRequest
     */
    update(dt) {
        const engine = getEngine();
        const sim = engine?.getSimulation();

        if (sim && sim.upkeepEnabled !== false) {
            sim.money -= (this.config.upkeep / 60) * dt;
        }

        this.processQueue(dt);

        const totalInSystem = this.queue.length + this.processing.length;
        const effectiveCapacity = this.config.capacity;
        this.load.utilization = effectiveCapacity > 0 ? Math.min(1, totalInSystem / effectiveCapacity) : 0;
        
        // Check roles for special behavior
        const isRoutingService = this.kind === SERVICE_KIND.LOAD_BALANCER || hasRole(this.catalogEntry, SERVICE_ROLE.ROUTING);
        const isUserService = this.kind === SERVICE_KIND.USER;
        const isComputeService = this.kind === SERVICE_KIND.COMPUTE || hasRole(this.catalogEntry, SERVICE_ROLE.COMPUTE);

        for (let i = this.processing.length - 1; i >= 0; i--) {
            const job = this.processing[i];
            job.timer += dt * 1000;

            if (job.timer >= this.config.processingTime) {
                this.processing.splice(i, 1);
                let failChance = calculateFailChanceBasedOnLoad(this.totalLoad);
                
                // Routing services and users don't fail requests
                if (isRoutingService || isUserService) {
                    failChance = 0;
                }

                if (Math.random() < failChance) {
                    failRequest(job.req);
                    continue;
                }

                // Compute role services mark requests as computed
                if (isComputeService) {
                    job.req.hasCompute = true;
                }

                const routeResult = getNextHop(engine?.getState(), job.req, this);
                if (!routeResult || routeResult.action === 'DEAD_END') {
                    if (sim?.metrics?.droppedByReason) {
                        sim.metrics.droppedByReason.misconfig = (sim.metrics.droppedByReason.misconfig || 0) + 1;
                    }
                    failRequest(job.req, 'misconfig');
                    continue;
                }

                if (routeResult.action === 'BLOCK') {
                    updateScore(job.req, 'FRAUD_BLOCKED');
                    removeRequest(job.req);
                    continue;
                }

                if (routeResult.action === 'TERMINATE') {
                    finishRequest(job.req);
                    continue;
                }

                if (routeResult.action === 'FORWARD' && routeResult.node) {
                    job.req.lastNodeId = this.id;
                    job.req.flyTo(routeResult.node);
                } else {
                    failRequest(job.req);
                }
            }
        }
    }

    get totalLoad() {
        return this.load.utilization;
    }

    destroy() {
        this.queue.length = 0;
        this.processing.length = 0;
    }

    getConnectedIds(includeInactive = false) {
        return getConnectionTargets(this, { includeInactive });
    }
}

export function upgradeConnectionFormatForService(service) {
    return normalizeConnections(service);
}

export { upgradeConnectionFormatForService as upgradeConnectionFormat };

export default Service;
