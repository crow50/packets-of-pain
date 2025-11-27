function normalizeServiceType(type) {
    switch (type) {
        case 'alb': return 'loadBalancer';
        case 'db': return 'database';
        case 's3': return 'objectStorage';
        case 'lambda': return 'compute';
        default: return type;
    }
}

const ROUTING_BASE_PRIORITY = {
    [TRAFFIC_TYPES.WEB]: {
        objectStorage: 120,
        loadBalancer: 80,
        compute: 60,
        switch: 40,
        firewall: 20,
        database: -40
    },
    [TRAFFIC_TYPES.API]: {
        database: 120,
        loadBalancer: 80,
        compute: 60,
        switch: 40,
        objectStorage: -40
    },
    [TRAFFIC_TYPES.FRAUD]: {
        waf: 140,
        firewall: 100,
        loadBalancer: 70,
        switch: 40,
        compute: 0,
        database: -40,
        objectStorage: -40
    }
};

const ROUTING_TERMINALS = {
    [TRAFFIC_TYPES.WEB]: ['objectStorage'],
    [TRAFFIC_TYPES.API]: ['database']
};

function getServiceEntity(id) {
    return id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);
}

function hasTerminalPath(node, targetTypes, depth = 3, visited = new Set()) {
    if (!node || depth < 0) return false;
    if (targetTypes.includes(node.type)) return true;
    visited.add(node.id);

    for (const nextId of node.connections) {
        if (nextId === 'internet') continue;
        const nextNode = getServiceEntity(nextId);
        if (!nextNode || visited.has(nextNode.id)) continue;
        const nextVisited = new Set(visited);
        if (hasTerminalPath(nextNode, targetTypes, depth - 1, nextVisited)) {
            return true;
        }
    }

    return false;
}

function getQueuePenalty(node) {
    if (!node || !Array.isArray(node.queue)) return 0;
    const capacity = node.config?.capacity || 1;
    return (node.queue.length / capacity) * 10;
}

function computeRoutingScore(neighbor, req) {
    const base = ROUTING_BASE_PRIORITY[req.type]?.[neighbor.type] ?? 0;
    let score = base;

    const terminalTypes = ROUTING_TERMINALS[req.type] || [];
    if (terminalTypes.length) {
        const leadsToTerminal = hasTerminalPath(neighbor, terminalTypes);
        score += leadsToTerminal ? 90 : -60; // strong bias for correct terminal
    }

    if (req.type === TRAFFIC_TYPES.WEB && req.hasCompute && neighbor.type === 'objectStorage') {
        score += 25;
    }
    if (req.type === TRAFFIC_TYPES.API && req.hasCompute && neighbor.type === 'database') {
        score += 25;
    }

    score -= getQueuePenalty(neighbor);
    score -= neighbor.connections.length * 0.1;
    return score;
}

function getNextHopForRequest(service, req) {
    const neighbors = service.connections
        .map(getServiceEntity)
        .filter(Boolean)
        .filter(n => n.id !== req.lastNodeId && n.id !== 'internet');

    if (!neighbors.length) return null;

    const scored = neighbors.map(node => ({
        node,
        score: computeRoutingScore(node, req)
    }));

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((a.node.queue?.length || 0) !== (b.node.queue?.length || 0)) {
            return (a.node.queue?.length || 0) - (b.node.queue?.length || 0);
        }
        return a.node.id.localeCompare(b.node.id);
    });

    return scored[0].node;
}

class Service {
    constructor(type, pos) {
        this.id = 'svc_' + Math.random().toString(36).substr(2, 9);
        this.type = normalizeServiceType(type);
        console.debug('Creating service of type:', this.type);
        this.config = CONFIG.services[this.type];
        this.position = pos.clone();
        this.queue = [];
        this.processing = [];
        this.connections = [];

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
        if (!['compute', 'database'].includes(this.type)) return;
        const tiers = CONFIG.services[this.type].tiers;
        if (this.tier >= tiers.length) return;

        const nextTier = tiers[this.tier];
        if (STATE.money < nextTier.cost) { flashMoney(); return; }

        STATE.money -= nextTier.cost;
        this.tier++;
        this.config = { ...this.config, capacity: nextTier.capacity };
        STATE.sound.playPlace();

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

    processQueue() {
        while (this.processing.length < this.config.capacity && this.queue.length > 0) {
            const req = this.queue.shift();

            if (this.type === 'waf' && req.type === TRAFFIC_TYPES.FRAUD) {
                updateScore(req, 'FRAUD_BLOCKED');
                removeRequest(req);
                continue;
            }

            // Prevent re-computing if already computed (pass through)
            if (this.type === 'compute' && req.hasCompute) {
                this.processing.push({ req: req, timer: this.config.processingTime });
                continue;
            }

            this.processing.push({ req: req, timer: 0 });
        }
    }

    update(dt) {
        STATE.money -= (this.config.upkeep / 60) * dt;

        this.processQueue();

        for (let i = this.processing.length - 1; i >= 0; i--) {
            let job = this.processing[i];
            job.timer += dt * 1000;

            if (job.timer >= this.config.processingTime) {
                this.processing.splice(i, 1);

                let failChance = calculateFailChanceBasedOnLoad(this.totalLoad);
                // Load Balancers are robust and shouldn't fail randomly based on load, only on queue saturation
                if (this.type === 'loadBalancer') {
                    failChance = 0;
                }

                if (Math.random() < failChance) {
                    failRequest(job.req);
                    continue;
                }

                if (this.type === 'objectStorage' && job.req.type === TRAFFIC_TYPES.WEB) {
                    finishRequest(job.req);
                    continue;
                }

                if (this.type === 'database' && job.req.type === TRAFFIC_TYPES.API) {
                    finishRequest(job.req);
                    continue;
                }

                if ((this.type === 'database' && job.req.type === TRAFFIC_TYPES.WEB) ||
                    (this.type === 'objectStorage' && job.req.type === TRAFFIC_TYPES.API)) {
                    failRequest(job.req);
                    continue;
                }

                if (this.type === 'compute') {
                    job.req.hasCompute = true;
                }

                const next = getNextHopForRequest(this, job.req);
                if (!next) {
                    failRequest(job.req);
                    continue;
                }

                job.req.lastNodeId = this.id;
                job.req.flyTo(next);
            }
        }

        if (this.totalLoad > 0.8) {
            this.loadRing.material.color.setHex(0xff0000);
            this.loadRing.material.opacity = 0.8;
        } else if (this.totalLoad > 0.5) {
            this.loadRing.material.color.setHex(0xffaa00);
            this.loadRing.material.opacity = 0.6;
        } else if (this.totalLoad > 0.2) {
            this.loadRing.material.color.setHex(0xffff00);
            this.loadRing.material.opacity = 0.4;
        } else {
            this.loadRing.material.color.setHex(0x00ff00);
            this.loadRing.material.opacity = 0.3;
        }
    }

    get totalLoad() {
        return (this.processing.length + this.queue.length) / (this.config.capacity * 2);
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
