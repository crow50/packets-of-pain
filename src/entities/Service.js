function normalizeServiceType(type) {
    switch (type) {
        case 'alb': return 'loadBalancer';
        case 'db': return 'database';
        case 's3': return 'objectStorage';
        case 'lambda': return 'compute';
        default: return type;
    }
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
        this.rrIndex = 0;

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
                req.destroy();
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

                if (this.type === 'database' || this.type === 'objectStorage') {
                    const expectedType = this.type === 'database' ? TRAFFIC_TYPES.API : TRAFFIC_TYPES.WEB;
                    if (job.req.type === expectedType) {
                        finishRequest(job.req);
                    } else {
                        failRequest(job.req);
                    }
                    continue;
                }

                if (this.type === 'compute') {
                    job.req.hasCompute = true;
                    const requiredType = job.req.type === TRAFFIC_TYPES.API ? 'database' : (job.req.type === TRAFFIC_TYPES.WEB ? 'objectStorage' : null);
                    let target = null;

                    if (requiredType) {
                        // Try to find preferred target
                        target = STATE.services.find(s =>
                            this.connections.includes(s.id) && s.type === requiredType && s.id !== job.req.lastNodeId
                        );
                    }

                    // Fallback to Round Robin if no preferred target found (allows arbitrary chains)
                    if (!target && this.connections.length > 0) {
                        let candidates = this.connections
                            .filter(id => id !== job.req.lastNodeId)
                            .map(id => STATE.services.find(s => s.id === id))
                            .filter(s => s !== undefined);

                        if (candidates.length === 0) {
                            // If no valid targets (dead end), allow backtracking
                            candidates = this.connections
                                .map(id => STATE.services.find(s => s.id === id))
                                .filter(s => s !== undefined);
                        }

                        if (candidates.length > 0) {
                            target = candidates[this.rrIndex % candidates.length];
                            this.rrIndex++;
                        }
                    }

                    if (target) {
                        job.req.lastNodeId = this.id;
                        job.req.flyTo(target);
                    } else {
                        failRequest(job.req);
                    }
                } else {
                    // Smart Routing (Prioritize downstream)
                    let candidates = this.connections
                        .filter(id => id !== job.req.lastNodeId)
                        .map(id => STATE.services.find(s => s.id === id))
                        .filter(s => s !== undefined);

                    // Define preferred types to avoid upstream flow
                    let preferredTypes = [];
                    let avoidTypes = [];

                    if (job.req.type === TRAFFIC_TYPES.FRAUD) {
                        preferredTypes = ['waf', 'loadBalancer'];
                    } else if (job.req.type === TRAFFIC_TYPES.WEB) {
                        if (job.req.hasCompute) {
                            preferredTypes = ['objectStorage', 'loadBalancer'];
                            avoidTypes = ['compute', 'database'];
                        } else {
                            preferredTypes = ['compute', 'loadBalancer'];
                            avoidTypes = ['objectStorage', 'database'];
                        }
                    } else if (job.req.type === TRAFFIC_TYPES.API) {
                        if (job.req.hasCompute) {
                            preferredTypes = ['database', 'loadBalancer'];
                            avoidTypes = ['compute', 'objectStorage'];
                        } else {
                            preferredTypes = ['compute', 'loadBalancer'];
                            avoidTypes = ['database', 'objectStorage'];
                        }
                    }

                    let finalCandidates = candidates.filter(s => preferredTypes.includes(s.type));
                    
                    if (finalCandidates.length === 0) {
                        finalCandidates = candidates.filter(s => !avoidTypes.includes(s.type));
                    }

                    if (finalCandidates.length === 0) {
                        finalCandidates = candidates;
                    }

                    // Hard filter for wrong storage types
                    if (job.req.type === TRAFFIC_TYPES.WEB) {
                        finalCandidates = finalCandidates.filter(s => s.type !== 'database');
                    } else if (job.req.type === TRAFFIC_TYPES.API) {
                        finalCandidates = finalCandidates.filter(s => s.type !== 'objectStorage');
                    }

                    if (finalCandidates.length === 0) {
                        // If no valid targets (dead end), allow backtracking
                        finalCandidates = this.connections
                            .map(id => STATE.services.find(s => s.id === id))
                            .filter(s => s !== undefined);

                        // Re-apply Hard filter for wrong storage types on backtracked candidates
                        if (job.req.type === TRAFFIC_TYPES.WEB) {
                            finalCandidates = finalCandidates.filter(s => s.type !== 'database');
                        } else if (job.req.type === TRAFFIC_TYPES.API) {
                            finalCandidates = finalCandidates.filter(s => s.type !== 'objectStorage');
                        }
                    }

                    if (finalCandidates.length > 0) {
                        // Load Balancing: Prefer targets with available queue space
                        // Sort by queue length (ascending) to find the least loaded target
                        finalCandidates.sort((a, b) => a.queue.length - b.queue.length);
                        
                        // Pick the best candidate (least loaded)
                        const target = finalCandidates[0];
                        
                        // If the best candidate is full (>= 20), we still send it (and it will fail),
                        // but this ensures we fill up empty queues first.

                        job.req.lastNodeId = this.id;
                        job.req.flyTo(target);
                    } else {
                        failRequest(job.req);
                    }
                }
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
