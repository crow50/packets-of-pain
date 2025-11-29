import { serviceGroup } from "./scene.js";

const SERVICE_MESH_DEFINITIONS = {
    waf: {
        geometry: () => new THREE.BoxGeometry(3, 2, 0.5),
        color: CONFIG.colors.waf,
        yOffset: 1
    },
    firewall: {
        geometry: () => new THREE.BoxGeometry(3, 1.5, 1.5),
        color: 0xff6b6b,
        yOffset: 0.8
    },
    switch: {
        geometry: () => new THREE.BoxGeometry(2.5, 0.75, 3),
        color: 0x64748b,
        yOffset: 0.4
    },
    modem: {
        geometry: () => new THREE.BoxGeometry(2, 0.75, 2),
        color: 0x38bdf8,
        yOffset: 0.5
    },
    loadBalancer: {
        geometry: () => new THREE.BoxGeometry(3, 1.5, 3),
        color: CONFIG.colors.loadBalancer,
        yOffset: 0.75
    },
    compute: {
        geometry: () => new THREE.CylinderGeometry(1.2, 1.2, 3, 16),
        color: CONFIG.colors.compute,
        yOffset: 1.5
    },
    database: {
        geometry: () => new THREE.CylinderGeometry(2, 2, 2, 6),
        color: CONFIG.colors.database,
        yOffset: 1
    },
    objectStorage: {
        geometry: () => new THREE.CylinderGeometry(1.8, 1.5, 1.5, 8),
        color: CONFIG.colors.objectStorage,
        yOffset: 0.75
    }
};

const DEFAULT_DEFINITION = {
    geometry: () => new THREE.BoxGeometry(2, 1, 2),
    color: 0x94a3b8,
    yOffset: 1
};

const serviceMeshes = new Map();
const listeners = [];
let engineRef = null;

function createMaterial(color) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.1
    });
}

function createLoadRing(mesh) {
    const ringGeo = new THREE.RingGeometry(2.5, 2.7, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x333333,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -mesh.position.y + 0.1;
    mesh.add(ring);
    return ring;
}

function createTierRing(mesh, tierLevel) {
    const baseRadius = 3.2;
    const radiusIncrement = 0.4;
    const innerRadius = baseRadius + (tierLevel - 2) * radiusIncrement;
    const outerRadius = innerRadius + 0.15;
    
    const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -mesh.position.y + 0.15;
    mesh.add(ring);
    return ring;
}

function updateTierRings(entry, tier) {
    if (!entry || !entry.mesh) return;
    
    // Remove existing tier rings
    if (entry.tierRings) {
        entry.tierRings.forEach(ring => {
            if (ring.geometry) ring.geometry.dispose();
            if (ring.material) ring.material.dispose();
            entry.mesh.remove(ring);
        });
    }
    
    entry.tierRings = [];
    
    // Create tier rings (tier 2 = 1 ring, tier 3 = 2 rings)
    for (let i = 2; i <= tier; i++) {
        const ring = createTierRing(entry.mesh, i);
        entry.tierRings.push(ring);
    }
}

function buildServiceMesh({ serviceId, type, position }) {
    const normalizedType = type?.toLowerCase?.() ?? 'unknown';
    const definition = SERVICE_MESH_DEFINITIONS[normalizedType] || DEFAULT_DEFINITION;
    const geom = definition.geometry();
    const mat = createMaterial(definition.color);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(position.x, definition.yOffset, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { id: serviceId, type: normalizedType, serviceId };

    const loadRing = createLoadRing(mesh);
    serviceGroup.add(mesh);

    return { mesh, loadRing, yOffset: definition.yOffset, tierRings: [] };
}

function disposeServiceMesh(entry) {
    if (!entry) return;
    const { mesh, loadRing, tierRings } = entry;
    if (loadRing) {
        if (loadRing.geometry) loadRing.geometry.dispose();
        if (loadRing.material) loadRing.material.dispose();
        mesh.remove(loadRing);
    }
    if (tierRings) {
        tierRings.forEach(ring => {
            if (ring.geometry) ring.geometry.dispose();
            if (ring.material) ring.material.dispose();
            mesh.remove(ring);
        });
    }
    if (mesh) {
        serviceGroup.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
    }
}

function setLoadRingColor(entry, utilization) {
    if (!entry || !entry.loadRing) return;
    const ring = entry.loadRing;
    if (utilization > 0.8) {
        ring.material.color.setHex(0xff0000);
        ring.material.opacity = 0.8;
    } else if (utilization > 0.5) {
        ring.material.color.setHex(0xffaa00);
        ring.material.opacity = 0.6;
    } else if (utilization > 0.2) {
        ring.material.color.setHex(0xffff00);
        ring.material.opacity = 0.4;
    } else {
        ring.material.color.setHex(0x00ff00);
        ring.material.opacity = 0.3;
    }
}

function handleServiceAdded(payload) {
    if (!payload) return;
    if (serviceMeshes.has(payload.serviceId)) return;
    const meshEntry = buildServiceMesh(payload);
    serviceMeshes.set(payload.serviceId, meshEntry);
}

function handleServiceRemoved({ serviceId }) {
    const entry = serviceMeshes.get(serviceId);
    disposeServiceMesh(entry);
    serviceMeshes.delete(serviceId);
}

function handleServiceUpgraded({ serviceId, tier }) {
    const entry = serviceMeshes.get(serviceId);
    if (entry) {
        updateTierRings(entry, tier);
    }
}

function sync(state) {
    if (!state) return;
    const services = state.simulation?.services || [];
    const activeServiceIds = new Set(services.map(s => s.id));
    const staleServiceIds = [];
    serviceMeshes.forEach((entry, serviceId) => {
        if (!activeServiceIds.has(serviceId)) {
            staleServiceIds.push(serviceId);
        }
    });
    staleServiceIds.forEach(serviceId => {
        const entry = serviceMeshes.get(serviceId);
        disposeServiceMesh(entry);
        serviceMeshes.delete(serviceId);
    });
    services.forEach(service => {
        const entry = serviceMeshes.get(service.id);
        if (!entry) return;
        const { mesh } = entry;
        const pos = service.position || { x: 0, y: 0, z: 0 };
        mesh.position.x = pos.x;
        mesh.position.z = pos.z;
        mesh.position.y = entry.yOffset ?? mesh.position.y;
        if (entry.loadRing) {
            entry.loadRing.position.y = -(entry.yOffset ?? mesh.position.y) + 0.1;
        }
        const utilization = service.load?.utilization ?? 0;
        setLoadRingColor(entry, utilization);
        
        // Ensure tier rings are synced
        const currentTier = service.tier || 1;
        const expectedRingCount = Math.max(0, currentTier - 1);
        const actualRingCount = entry.tierRings?.length || 0;
        if (actualRingCount !== expectedRingCount) {
            updateTierRings(entry, currentTier);
        }
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
    subscribe('serviceAdded', handleServiceAdded);
    subscribe('serviceRemoved', handleServiceRemoved);
    subscribe('serviceUpgraded', handleServiceUpgraded);
}

export function dispose() {
    listeners.forEach(fn => fn());
    listeners.length = 0;
    serviceMeshes.forEach(entry => disposeServiceMesh(entry));
    serviceMeshes.clear();
    engineRef = null;
}

export function getMesh(serviceId) {
    return serviceMeshes.get(serviceId)?.mesh;
}

export function syncServices(state) {
    sync(state);
}
