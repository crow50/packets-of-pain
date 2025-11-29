import { copyPosition, toPlainPosition } from "../sim/vectorUtils.js";

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

const MAX_HOPS = 16;
const DEFAULT_HEIGHT = 2;

function clonePosition(source) {
    const base = toPlainPosition(source);
    base.y = DEFAULT_HEIGHT;
    return base;
}

class Request {
    constructor(type, originPosition) {
        this.id = Math.random().toString(36);
        this.value = 10;
        this.type = type;

        const internetNode = getEngine()?.getSimulation()?.internetNode;
        const spawnSource = originPosition || internetNode?.position;
        const startPos = clonePosition(spawnSource);

        this.position = { ...startPos };
        this.origin = { ...startPos };

        this.target = null;
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
        copyPosition(this.origin, this.position);
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
                copyPosition(this.position, this.target.position ?? this.position);
                this.position.y = DEFAULT_HEIGHT;

                const node = this.target;
                if (!node || !Array.isArray(node.queue) || node.queue.length >= 20) {
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

    destroy() {
        this.target = null;
        this.isMoving = false;
        this.path.length = 0;
    }
}

export default Request;
