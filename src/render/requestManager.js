import { requestGroup } from "./scene.js";

const listeners = [];
const requestMeshes = new Map();
let engineRef = null;

const REQUEST_COLORS = {
    WEB: CONFIG.colors.requestWeb,
    API: CONFIG.colors.requestApi,
    FRAUD: CONFIG.colors.requestFraud
};

function getColorForType(type) {
    return REQUEST_COLORS[type] ?? CONFIG.colors.requestFail;
}

function createRequestMesh({ requestId, type, from }) {
    const geometry = new THREE.SphereGeometry(0.4, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: getColorForType(type) });
    const mesh = new THREE.Mesh(geometry, material);
    const position = from || { x: 0, y: 2, z: 0 };
    mesh.position.set(position.x, position.y, position.z);
    mesh.userData = { requestId, type };
    requestGroup.add(mesh);
    return { mesh, geometry, material };
}

function disposeRequestMesh(entry) {
    if (!entry) return;
    const { mesh, geometry, material } = entry;
    if (mesh) {
        requestGroup.remove(mesh);
        mesh.geometry?.dispose();
        mesh.material?.dispose();
    }
    if (geometry && geometry !== mesh?.geometry) geometry.dispose();
    if (material && material !== mesh?.material) material.dispose();
}

function removeRequestMesh(requestId) {
    const entry = requestMeshes.get(requestId);
    if (!entry) return;
    disposeRequestMesh(entry);
    requestMeshes.delete(requestId);
}

function handleRequestSpawned(payload) {
    if (!payload || requestMeshes.has(payload.requestId)) return;
    const entry = createRequestMesh(payload);
    requestMeshes.set(payload.requestId, entry);
}

function handleRequestFinished(payload) {
    if (!payload) return;
    removeRequestMesh(payload.requestId);
}

function handleRequestFailed(payload) {
    if (!payload) return;
    removeRequestMesh(payload.requestId);
}

function subscribe(event, handler) {
    if (!engineRef) return;
    const unsubscribe = engineRef.on(event, handler);
    if (typeof unsubscribe === 'function') {
        listeners.push(unsubscribe);
    }
}

export function init(engine) {
    engineRef = engine;
    subscribe('requestSpawned', handleRequestSpawned);
    subscribe('requestFinished', handleRequestFinished);
    subscribe('requestFailed', handleRequestFailed);
}

export function dispose() {
    listeners.forEach(fn => fn());
    listeners.length = 0;
    requestMeshes.forEach(entry => disposeRequestMesh(entry));
    requestMeshes.clear();
    engineRef = null;
}

export function syncRequests(state) {
    if (!state) return;
    const requests = state.simulation?.requests || [];
    const activeIds = new Set(requests.map(req => req.id));
    const staleIds = [];
    requestMeshes.forEach((entry, requestId) => {
        if (!activeIds.has(requestId)) {
            staleIds.push(requestId);
        }
    });
    staleIds.forEach(id => removeRequestMesh(id));

    requests.forEach(req => {
        const entry = requestMeshes.get(req.id);
        if (!entry) return;
        const pos = req.position || { x: 0, y: 2, z: 0 };
        entry.mesh.position.set(pos.x, pos.y ?? 2, pos.z);
    });
}
