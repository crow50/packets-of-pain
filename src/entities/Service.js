// Service catalog helpers are available globally via window.ServiceCatalog
// Routing helpers are available globally via window.Routing

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

function normalizeServiceType(type) {
    switch (type) {
        case 'alb': return 'loadBalancer';
        case 'db': return 'database';
        case 's3': return 'objectStorage';
        case 'lambda': return 'compute';
        default: return type;
    }
}

function getServiceEntity(id) {
    const sim = getEngine()?.getSimulation();
    if (!sim) return null;
    return id === 'internet' ? sim.internetNode : sim.services.find(s => s.id === id);
}

class Service {
    constructor(type, pos) {
        this.id = 'svc_' + Math.random().toString(36).substr(2, 9);
        this.type = normalizeServiceType(type);
        console.debug('Creating service of type:', this.type);
        
        // Build config from service catalog (single source of truth)
        const catalog = window.ServiceCatalog;
        const catalogEntry = catalog?.getServiceType?.(this.type);
        this.catalogEntry = catalogEntry;
        
        // Build config object from catalog
        if (catalogEntry) {
            this.config = {
                name: catalogEntry.label,
                cost: catalogEntry.baseCost,
                type: catalogEntry.key,
                processingTime: catalogEntry.processingTime,
                capacity: catalog.getCapacityForTier(this.type, 1),
                upkeep: catalogEntry.upkeepPerTick
            };
        } else {
            console.warn('Service type not found in catalog:', this.type);
            this.config = { capacity: 1, processingTime: 100, upkeep: 0 };
        }
        
        this.position = pos.clone();
        this.queue = [];
        this.processing = [];
        this.connections = [];
        
        // Load tracking for visualization and metrics
        this.load = {
            lastTickProcessed: 0,
            lastTickCapacity: this.config.capacity,
            utilization: 0,
            dropped: 0
        };

        let geo, mat;
        const materialProps = { roughness: 0.2 };

        switch (this.type) {
            case 'waf':
                geo = new THREE.BoxGeometry(3, 2, 0.5);
                mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.waf, ...materialProps });
                break;
            case 'firewall':
                geo = new THREE.BoxGeometry(3, 1.5, 1.5);
                mat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.3 });
                break;
            case 'switch':
                geo = new THREE.BoxGeometry(2.5, 0.75, 3);
                mat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3 });
                break;
            case 'modem':
                geo = new THREE.BoxGeometry(2, 0.75, 2);
                mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
                break;
            case 'loadBalancer':
                geo = new THREE.BoxGeometry(3, 1.5, 3);
                mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.loadBalancer, roughness: 0.1 });
                break;
            case 'compute':
                geo = new THREE.CylinderGeometry(1.2, 1.2, 3, 16);
                mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.compute, ...materialProps });
                break;
            case 'database':
                geo = new THREE.CylinderGeometry(2, 2, 2, 6);
                mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.database, roughness: 0.3 });
                break;
            case 'objectStorage':
                geo = new THREE.CylinderGeometry(1.8, 1.5, 1.5, 8);
                mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.objectStorage, ...materialProps });
                break;
            default:
                console.warn('Unknown service type:', this.type);
                return;
        }

        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(pos);

        if (this.type === 'waf') this.mesh.position.y += 1;
        else if (this.type === 'firewall') this.mesh.position.y += 0.8;
        else if (this.type === 'switch') this.mesh.position.y += 0.4;
        else if (this.type === 'modem') this.mesh.position.y += 0.5;
        else if (this.type === 'loadBalancer') this.mesh.position.y += 0.75;
        else if (this.type === 'compute') this.mesh.position.y += 1.5;
        else if (this.type === 'objectStorage') this.mesh.position.y += 0.75;
        else this.mesh.position.y += 1;

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData = { id: this.id };

        const ringGeo = new THREE.RingGeometry(2.5, 2.7, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        this.loadRing = new THREE.Mesh(ringGeo, ringMat);
        this.loadRing.rotation.x = -Math.PI / 2;
        this.loadRing.position.y = -this.mesh.position.y + 0.1;
        this.mesh.add(this.loadRing);

        this.tier = 1;
        this.tierRings = [];

        serviceGroup.add(this.mesh);
    }

    upgrade() {
        // Check if this service type supports upgrades via the catalog
        const catalog = window.ServiceCatalog;
        if (!catalog?.canUpgrade?.(this.type)) return;
        
        const catalogEntry = catalog?.getServiceType?.(this.type);
        const maxTiers = catalogEntry?.tiers?.length || 1;
        if (this.tier >= maxTiers) return;

        const engine = getEngine();
        const sim = engine?.getSimulation();
        const ui = engine?.getUIState();
        if (!sim) return;

        // Get upgrade cost from catalog
        const upgradeCost = catalog.getUpgradeCost(this.type, this.tier);
        if (upgradeCost === null) return;
        if (sim.money < upgradeCost) { flashMoney(); return; }

        sim.money -= upgradeCost;
        this.tier++;
        
        // Update capacity from catalog
        const newCapacity = catalog.getCapacityForTier(this.type, this.tier);
        this.config = { ...this.config, capacity: newCapacity };
        ui?.sound?.playPlace?.();

        // Visuals
        const ringGeo = new THREE.TorusGeometry(this.type === 'database' ? 2.2 : 1.3, 0.1, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: this.type === 'database' ? 0xff0000 : 0xffff00 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        // Tier rings
        ring.position.y = -this.mesh.position.y + (this.tier === 2 ? 0.5 : 1.0);
        this.mesh.add(ring);
        this.tierRings.push(ring);
    }

    processQueue(dt) {
        const catalog = window.ServiceCatalog;
        const routing = window.Routing;
        
        // Capacity is packets per second, scale by dt
        const capacityPerSec = this.config.capacity;
        const maxToProcess = Math.max(1, Math.floor(capacityPerSec * dt));
        let processed = 0;
        
        while (processed < maxToProcess && this.processing.length < capacityPerSec && this.queue.length > 0) {
            const req = this.queue.shift();

            // Use catalog to check if this service blocks this traffic type
            if (routing?.isBlocked(this.catalogEntry, req.type)) {
                updateScore(req, 'FRAUD_BLOCKED');
                removeRequest(req);
                processed++;
                continue;
            }

            // Prevent re-computing if already computed (pass through)
            if (this.type === 'compute' && req.hasCompute) {
                this.processing.push({ req: req, timer: this.config.processingTime });
                processed++;
                continue;
            }

            this.processing.push({ req: req, timer: 0 });
            processed++;
        }
        
        // Track load metrics
        this.load.lastTickProcessed = processed;
        this.load.lastTickCapacity = maxToProcess;
        
        // Handle overflow - if queue is too long, drop excess with penalty
        const maxQueueSize = capacityPerSec * 3; // Allow 3 seconds of backlog
        if (this.queue.length > maxQueueSize) {
            const overflow = this.queue.length - maxQueueSize;
            const engine = getEngine();
            const sim = engine?.getSimulation();
            
            for (let i = 0; i < overflow; i++) {
                const dropped = this.queue.shift();
                if (dropped) {
                    // Track dropped packets
                    this.load.dropped++;
                    if (sim?.metrics?.droppedByReason) {
                        sim.metrics.droppedByReason.overload = (sim.metrics.droppedByReason.overload || 0) + 1;
                    }
                    // Small rep penalty for overload drops
                    if (sim) {
                        sim.reputation = Math.max(0, sim.reputation - 0.5);
                    }
                    removeRequest(dropped);
                }
            }
        }
    }

    update(dt) {
        const engine = getEngine();
        const sim = engine?.getSimulation();
        const state = engine?.getState();
        const routing = window.Routing;
        
        if (sim) sim.money -= (this.config.upkeep / 60) * dt;

        this.processQueue(dt);
        
        // Calculate utilization based on queue + processing vs capacity
        const totalInSystem = this.queue.length + this.processing.length;
        const effectiveCapacity = this.config.capacity;
        this.load.utilization = effectiveCapacity > 0 ? Math.min(1, totalInSystem / effectiveCapacity) : 0;

        for (let i = this.processing.length - 1; i >= 0; i--) {
            let job = this.processing[i];
            job.timer += dt * 1000;

            if (job.timer >= this.config.processingTime) {
                this.processing.splice(i, 1);

                let failChance = calculateFailChanceBasedOnLoad(this.totalLoad);
                // Load Balancers are robust and shouldn't fail randomly based on load
                if (this.type === 'loadBalancer') {
                    failChance = 0;
                }

                if (Math.random() < failChance) {
                    failRequest(job.req);
                    continue;
                }

                // Mark compute flag before routing decision
                if (this.type === 'compute') {
                    job.req.hasCompute = true;
                }

                // Use catalog-driven routing
                const routeResult = routing?.getNextHop(state, job.req, this);
                
                if (!routeResult || routeResult.action === 'DEAD_END') {
                    // DEAD_END means topology misconfiguration - heavier penalty
                    if (sim?.metrics?.droppedByReason) {
                        sim.metrics.droppedByReason.misconfig = (sim.metrics.droppedByReason.misconfig || 0) + 1;
                    }
                    // Heavier rep penalty for misconfig (2x normal fail)
                    failRequest(job.req, 'misconfig');
                    continue;
                }
                
                if (routeResult.action === 'BLOCK') {
                    // Already handled in processQueue, but just in case
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

        // Visual feedback based on utilization
        const util = this.load.utilization;
        if (util > 0.8) {
            this.loadRing.material.color.setHex(0xff0000);
            this.loadRing.material.opacity = 0.8;
        } else if (util > 0.5) {
            this.loadRing.material.color.setHex(0xffaa00);
            this.loadRing.material.opacity = 0.6;
        } else if (util > 0.2) {
            this.loadRing.material.color.setHex(0xffff00);
            this.loadRing.material.opacity = 0.4;
        } else {
            this.loadRing.material.color.setHex(0x00ff00);
            this.loadRing.material.opacity = 0.3;
        }
        
        // Scale load ring based on utilization
        const ringScale = 0.5 + (util * 0.5);
        this.loadRing.scale.set(ringScale, ringScale, 1);
    }

    get totalLoad() {
        return this.load.utilization;
    }

    destroy() {
        serviceGroup.remove(this.mesh);
        if (this.tierRings) {
            this.tierRings.forEach(r => {
                r.geometry.dispose();
                r.material.dispose();
            });
        }
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
