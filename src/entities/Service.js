
import { copyPosition, toPosition } from "../sim/vectorUtils.js";
import { flashMoney } from "../sim/tools.js";

const { getServiceType, getCapacityForTier, getUpgradeCost, canUpgrade } = window.ServiceCatalog;

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

function emit(event, payload) {
    const engine = getEngine();
    engine?.emit?.(event, payload);
}

class Service {
    constructor(type, pos) {
        this.id = 'svc_' + Math.random().toString(36).substr(2, 9);
        this.type = this.normalizeServiceType(type);
        this.catalogEntry = getServiceType(this.type);
        this.config = {
            name: this.catalogEntry?.label || this.type,
            cost: this.catalogEntry?.baseCost ?? 0,
            type: this.catalogEntry?.key || this.type,
            processingTime: this.catalogEntry?.processingTime || 100,
            capacity: getCapacityForTier(this.type, 1),
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

    normalizeServiceType(type) {
        switch (type) {
            case 'alb': return 'loadBalancer';
            case 'db': return 'database';
            case 's3': return 'objectStorage';
            case 'lambda': return 'compute';
            default: return type;
        }
    }

    upgrade(state) {
        if (!canUpgrade(this.type)) return;
        const sim = state.simulation;
        const upgradeCost = getUpgradeCost(this.type, this.tier);
        if (upgradeCost === null) return;
        if (sim.money < upgradeCost) {
            flashMoney();
            return;
        }

        sim.money -= upgradeCost;
        this.tier += 1;
        this.config.capacity = getCapacityForTier(this.type, this.tier);
        this.load.lastTickCapacity = this.config.capacity;
        emit('serviceUpgraded', { serviceId: this.id, tier: this.tier });
    }

    processQueue(dt) {
        const routing = window.Routing;
        const capacityPerSec = this.config.capacity;
        const maxToProcess = Math.max(1, Math.floor(capacityPerSec * dt));
        let processed = 0;

        while (processed < maxToProcess && this.processing.length < capacityPerSec && this.queue.length > 0) {
            const req = this.queue.shift();
            if (routing?.isBlocked(this.catalogEntry, req.type)) {
                window.updateScore(req, 'FRAUD_BLOCKED');
                window.removeRequest(req);
                processed++;
                continue;
            }

            if (this.type === 'compute' && req.hasCompute) {
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
                    window.removeRequest(dropped);
                }
            }
        }
    }

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

        for (let i = this.processing.length - 1; i >= 0; i--) {
            const job = this.processing[i];
            job.timer += dt * 1000;

            if (job.timer >= this.config.processingTime) {
                this.processing.splice(i, 1);
                let failChance = calculateFailChanceBasedOnLoad(this.totalLoad);
                if (this.type === 'loadBalancer') {
                    failChance = 0;
                }

                if (Math.random() < failChance) {
                    window.failRequest(job.req);
                    continue;
                }

                if (this.type === 'compute') {
                    job.req.hasCompute = true;
                }

                const routeResult = window.Routing?.getNextHop?.(engine?.getState(), job.req, this);
                if (!routeResult || routeResult.action === 'DEAD_END') {
                    if (sim?.metrics?.droppedByReason) {
                        sim.metrics.droppedByReason.misconfig = (sim.metrics.droppedByReason.misconfig || 0) + 1;
                    }
                    window.failRequest(job.req, 'misconfig');
                    continue;
                }

                if (routeResult.action === 'BLOCK') {
                    window.updateScore(job.req, 'FRAUD_BLOCKED');
                    window.removeRequest(job.req);
                    continue;
                }

                if (routeResult.action === 'TERMINATE') {
                    window.finishRequest(job.req);
                    continue;
                }

                if (routeResult.action === 'FORWARD' && routeResult.node) {
                    job.req.lastNodeId = this.id;
                    job.req.flyTo(routeResult.node);
                } else {
                    window.failRequest(job.req);
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
}

export default Service;
