function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

const MAX_HOPS = 16;

class Request {
    constructor(type) {
        this.id = Math.random().toString(36);
        this.value = 10;
        this.type = type;

        let color;
        switch (this.type) {
            case TRAFFIC_TYPES.WEB: color = CONFIG.colors.requestWeb; break;
            case TRAFFIC_TYPES.API: color = CONFIG.colors.requestApi; break;
            case TRAFFIC_TYPES.FRAUD: color = CONFIG.colors.requestFraud; break;
        }

        const geo = new THREE.SphereGeometry(0.4, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geo, mat);

        const internetNode = getEngine()?.getSimulation()?.internetNode;
        this.mesh.position.copy(internetNode?.position || new THREE.Vector3(0, 2, 0));
        this.mesh.position.y = 2;
        requestGroup.add(this.mesh);

        this.target = null;
        this.origin = internetNode?.position?.clone() || new THREE.Vector3(0, 2, 0);
        this.origin.y = 2;
        this.progress = 0;
        this.isMoving = false;
        this.hops = 0;
        this.path = [];
        this._ttlFailed = false;
        this.hasCompute = false;
        this.lastNodeId = null;
    }

    flyTo(service) {
        if (!service) return;
        this.origin.copy(this.mesh.position);
        this.target = service;
        this.progress = 0;
        this.isMoving = true;
        this.hops += 1;
        this.path.push(service.id);
    }

    update(dt) {
        if (this.hops > MAX_HOPS) {
            if (!this._ttlFailed) {
                this._ttlFailed = true;
                failRequest(this);
            }
            return;
        }

        if (this.isMoving && this.target) {
            this.progress += dt * 2;
            if (this.progress >= 1) {
                this.progress = 1;
                this.isMoving = false;
                this.mesh.position.copy(this.target.position);
                this.mesh.position.y = 2;

                const node = this.target;
                if (!node || !Array.isArray(node.queue) || node.queue.length >= 20) {
                    failRequest(this);
                } else {
                    node.queue.push(this);
                }
            } else {
                const dest = this.target.position.clone();
                dest.y = 2;
                this.mesh.position.lerpVectors(this.origin, dest, this.progress);
                this.mesh.position.y += Math.sin(this.progress * Math.PI) * 2;
            }
        }
    }

    destroy() {
        requestGroup.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
