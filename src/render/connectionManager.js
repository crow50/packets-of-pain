import { connectionGroup } from "./scene.js";

const connectionMeshes = new Map();
const listeners = [];
let engineRef = null;

function getPositionForId(id, state) {
    if (!id || !state) return { x: 0, y: 0, z: 0 };
    const sim = state.simulation;
    if (id === 'internet') {
        return sim.internetNode?.position || { x: 0, y: 0, z: 0 };
    }
    const service = sim.services?.find(s => s.id === id);
    if (service) {
        return service.position || { x: 0, y: 0, z: 0 };
    }
    return { x: 0, y: 0, z: 0 };
}

function createLineMesh(linkId, fromPos, toPos, linkData) {
    // Create visible line
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
        fromPos.x, fromPos.y + 1, fromPos.z,
        toPos.x, toPos.y + 1, toPos.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: CONFIG.colors.line, linewidth: 2 });
    const mesh = new THREE.Line(geometry, material);
    
    // Store full link object for deletion support
    mesh.userData = { 
        linkId,
        link: linkData || { id: linkId, from: null, to: null }
    };
    connectionGroup.add(mesh);
    
    // Create invisible tube geometry for easier raycasting/clicking
    const direction = new THREE.Vector3(
        toPos.x - fromPos.x,
        0,
        toPos.z - fromPos.z
    );
    const length = direction.length();
    direction.normalize();
    
    const tubeGeometry = new THREE.CylinderGeometry(0.5, 0.5, length, 8);
    const tubeMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
    
    // Position tube at midpoint between from and to
    hitMesh.position.set(
        (fromPos.x + toPos.x) / 2,
        fromPos.y + 1,
        (fromPos.z + toPos.z) / 2
    );
    
    // Rotate tube to align with connection direction
    hitMesh.rotation.z = Math.PI / 2;
    hitMesh.rotation.y = Math.atan2(direction.x, direction.z);
    
    // Store same link data on hit mesh
    hitMesh.userData = { 
        linkId,
        link: linkData || { id: linkId, from: null, to: null }
    };
    connectionGroup.add(hitMesh);
    
    return { mesh, geometry, hitMesh, tubeGeometry };
}

export function updateConnectionGeometry(linkId, fromPos, toPos) {
    const entry = connectionMeshes.get(linkId);
    if (!entry) return;
    const mesh = entry.mesh;
    const attr = mesh.geometry.attributes.position;
    attr.array[0] = fromPos.x;
    attr.array[1] = fromPos.y + 1;
    attr.array[2] = fromPos.z;
    attr.array[3] = toPos.x;
    attr.array[4] = toPos.y + 1;
    attr.array[5] = toPos.z;
    attr.needsUpdate = true;
}

function handleConnectionCreated(payload) {
    if (!payload || connectionMeshes.has(payload.linkId)) return;
    const state = engineRef?.getState?.();
    if (!state) return;
    const fromPos = getPositionForId(payload.from, state);
    const toPos = getPositionForId(payload.to, state);
    // Pass full link data for deletion support
    const linkData = { id: payload.linkId, from: payload.from, to: payload.to };
    const entry = createLineMesh(payload.linkId, fromPos, toPos, linkData);
    connectionMeshes.set(payload.linkId, entry);
}

function handleConnectionDeleted({ linkId }) {
    const entry = connectionMeshes.get(linkId);
    if (!entry) return;
    const { mesh, hitMesh, tubeGeometry } = entry;
    connectionGroup.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    // Also remove invisible hit mesh
    if (hitMesh) {
        connectionGroup.remove(hitMesh);
        if (tubeGeometry) tubeGeometry.dispose();
        if (hitMesh.material) hitMesh.material.dispose();
    }
    connectionMeshes.delete(linkId);
}

function sync(state) {
    if (!state) return;
    const links = state.simulation?.connections || [];
    const activeLinkIds = new Set(links.map(link => link.id));
    const staleLinkIds = [];
    connectionMeshes.forEach((entry, linkId) => {
        if (!activeLinkIds.has(linkId)) {
            staleLinkIds.push(linkId);
        }
    });
    staleLinkIds.forEach(linkId => handleConnectionDeleted({ linkId }));
    links.forEach(link => {
        const fromPos = getPositionForId(link.from, state);
        const toPos = getPositionForId(link.to, state);
        updateConnectionGeometry(link.id, fromPos, toPos);
    });
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
    subscribe('connectionCreated', handleConnectionCreated);
    subscribe('connectionDeleted', handleConnectionDeleted);
}

export function dispose() {
    listeners.forEach(fn => fn());
    listeners.length = 0;
    connectionMeshes.forEach(entry => {
        const { mesh, hitMesh, tubeGeometry } = entry;
        connectionGroup.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
        // Also clean up invisible hit mesh
        if (hitMesh) {
            connectionGroup.remove(hitMesh);
            if (tubeGeometry) tubeGeometry.dispose();
            if (hitMesh.material) hitMesh.material.dispose();
        }
    });
    connectionMeshes.clear();
    engineRef = null;
}

export function getMesh(linkId) {
    return connectionMeshes.get(linkId)?.mesh;
}

export function syncConnections(state) {
    sync(state);
}
import { CONFIG } from "../config/gameConfig.js";
