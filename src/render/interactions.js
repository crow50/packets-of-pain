import { camera, renderer, serviceGroup, connectionGroup } from "./scene.js";
import { internetMesh } from "./scene.js";
import { updateConnectionGeometry } from "./connectionManager.js";

const { getServiceType, getCapacityForTier, canUpgrade, getUpgradeCost } = window.ServiceCatalog;

// Module-level engine reference
let _engine = null;

// Three.js helpers used by input controller
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
export const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// Back-compat engine accessor
function getEngine() {
    return _engine || window.__POP_RUNTIME__?.current?.engine;
}

export function init(engine) {
    _engine = engine;
}

// Minimal init for legacy bootstrap compatibility
export function initInteractions() {
    // no-op: kept for backward compatibility
}

export function snapToGrid(vec3, step = 5) {
    if (!vec3) return vec3;
    vec3.x = Math.round(vec3.x / step) * step;
    vec3.y = Math.round((vec3.y || 0) / step) * step;
    vec3.z = Math.round(vec3.z / step) * step;
    return vec3;
}

export function updateLinkVisuals(link) {
    if (!link) return;
    updateConnectionGeometry(link);
}

export function getIntersect(clientX, clientY) {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    raycaster.setFromCamera(mouse, camera);

    // Check services first
    const svcHits = serviceGroup ? raycaster.intersectObjects(serviceGroup.children, true) : [];
    if (svcHits.length) {
        let obj = svcHits[0].object;
        // Traverse up to find the mesh that owns userData.id (handles rings/child meshes)
        while (obj && !obj.userData?.id && obj.parent && obj.parent !== serviceGroup) {
            obj = obj.parent;
        }
        const id = obj?.userData?.id || obj?.name;
        if (id) return { type: 'service', id, object: obj };
    }

    if (internetMesh) {
        const inetHits = raycaster.intersectObject(internetMesh, true);
        if (inetHits.length) {
            return { type: 'internet', id: 'internet', object: internetMesh };
        }
    }

    // Then check connections
    const connHits = connectionGroup ? raycaster.intersectObjects(connectionGroup.children, true) : [];
    if (connHits.length) {
        const obj = connHits[0].object;
        let link = obj?.userData?.link;
        
        // Fallback: if link object not stored, look up by linkId from engine state
        if (!link && obj?.userData?.linkId) {
            const engine = getEngine();
            const connections = engine?.getSimulation()?.connections || [];
            link = connections.find(c => c.id === obj.userData.linkId);
        }
        
        if (link) {
            return { type: 'link', id: `${link.from}-${link.to}`, link, object: obj };
        }
    }

    // Finally, intersect with ground plane to allow placement
    const hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hitPoint)) {
        return { type: 'ground', pos: hitPoint.clone() };
    }

    return null;
}

export function updateTooltip() {
    const tooltip = document.getElementById('tooltip');
    const engine = getEngine();
    const uiState = engine?.getUIState();
    const hovered = uiState?.hovered;
    const selectedNodeId = uiState?.selectedNodeId;
    if (!tooltip || tooltip.style.display === 'none') return;

    const sim = engine?.getSimulation();
    const hoveredInfo = hovered;
    const hoveredLink = hoveredInfo?.type === 'link' ? hoveredInfo : null;
    let id = null;
    let type = null;

    if (selectedNodeId) {
        id = selectedNodeId;
        type = selectedNodeId === 'internet' ? 'internet' : 'service';
    } else if (hoveredInfo && ['service', 'link', 'internet'].includes(hoveredInfo.type)) {
        id = hoveredInfo.id;
        type = hoveredInfo.type;
    } else {
        return;
    }

    let content = `<div class="font-bold border-b border-gray-500 pb-1 mb-1 text-xs">${id}</div>`;

    if (type === 'service') {
        const svc = sim?.services?.find(s => s.id === id);
        if (svc) {
            const catalogEntry = getServiceType(svc.type);
            const displayName = catalogEntry?.label ?? svc.config?.name ?? svc.type;
            const upkeep = catalogEntry?.upkeepPerTick ?? svc.config?.upkeep ?? 0;
            const processingTime = catalogEntry?.processingTime ?? svc.config?.processingTime ?? 100;
            const capacity = getCapacityForTier(svc.type, svc.tier || 1);
            const maxTiers = catalogEntry?.tiers?.length || 1;
            const currentTier = svc.tier || 1;
            const isMaxTier = currentTier >= maxTiers;
            const isUpgradeable = canUpgrade(svc.type);
            const upgradeCost = isUpgradeable && !isMaxTier ? getUpgradeCost(svc.type, currentTier) : null;

            const utilization = svc.load?.utilization ?? 0;
            const loadPct = Math.round(utilization * 100);
            const loadColor = loadPct > 80 ? 'text-red-400' : (loadPct > 50 ? 'text-yellow-400' : 'text-green-400');
            const dropped = svc.load?.dropped ?? 0;

            const accepts = catalogEntry?.accepts?.join(', ') || 'All';
            const blocks = catalogEntry?.blocks?.length ? catalogEntry.blocks.join(', ') : 'None';
            const terminalFor = catalogEntry?.terminalFor?.length ? catalogEntry.terminalFor.join(', ') : 'None';
            const tip = catalogEntry?.tip || null;

            content += `
                <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                    <span class="text-gray-400">Type:</span> <span class="text-white capitalize">${displayName}</span>
                    <span class="text-gray-400">Tier:</span> <span class="text-white">${currentTier}/${maxTiers}</span>
                    ${isUpgradeable && isMaxTier ? '<span class="text-gray-400">Upgrade:</span> <span class="text-gray-400 italic">No upgrade available, at max tier</span>' : ''}
                    ${isUpgradeable && !isMaxTier ? `<span class="text-gray-400">Upgrade:</span> <span class="text-green-400">$${upgradeCost}</span>` : ''}
                    ${!isUpgradeable ? '<span class="text-gray-400">Upgrade:</span> <span class="text-gray-400 italic">No upgrade available</span>' : ''}
                    <span class="text-gray-400">Capacity:</span> <span class="text-white">${capacity}/sec</span>
                    <span class="text-gray-400">Load:</span> <span class="${loadColor}">${loadPct}%</span>
                    <span class="text-gray-400">Queue:</span> <span class="text-white">${svc.queue.length}</span>
                    <span class="text-gray-400">Proc:</span> <span class="text-white">${svc.processing.length}</span>
                    <span class="text-gray-400">Speed:</span> <span class="text-white">${processingTime}ms</span>
                    <span class="text-gray-400">Upkeep:</span> <span class="text-yellow-400">$${(upkeep / 60).toFixed(2)}/s</span>
                    ${dropped > 0 ? `<span class="text-gray-400">Dropped:</span> <span class="text-red-400">${dropped}</span>` : ''}
                </div>
                <div class="mt-1 pt-1 border-t border-gray-600 text-[9px]">
                    <div><span class="text-gray-400">Accepts:</span> <span class="text-cyan-300">${accepts}</span></div>
                    ${blocks !== 'None' ? `<div><span class="text-gray-400">Blocks:</span> <span class="text-red-300">${blocks}</span></div>` : ''}
                    ${terminalFor !== 'None' ? `<div><span class="text-gray-400">Terminal:</span> <span class="text-green-300">${terminalFor}</span></div>` : ''}
                </div>
                ${tip ? `<div class="mt-1 pt-1 border-t border-gray-600 text-[9px] text-blue-300 italic">💡 ${tip}</div>` : ''}
            `;
        }
    } else if (type === 'link' && hoveredLink?.link) {
        const link = hoveredLink.link;
        const requests = sim?.requests || [];
        const traffic = requests.filter(r =>
            r.isMoving && r.target && (
                (r.lastNodeId === link.from && r.target.id === link.to) ||
                (r.lastNodeId === link.to && r.target.id === link.from)
            )
        ).length;

        content += `
            <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                <span class="text-gray-400">Type:</span> <span class="text-white">Wired</span>
                <span class="text-gray-400">Traffic:</span> <span class="text-white">${traffic} pkts</span>
            </div>
        `;
    } else if (type === 'internet') {
        const catalogEntry = getServiceType('INTERNET');
        const displayName = catalogEntry?.label ?? 'Internet';
        const position = sim?.internetNode?.position ?? { x: 0, y: 0, z: 0 };
        const connectionCount = sim?.internetNode?.connections?.length ?? 0;
        const tip = catalogEntry?.tip || null;
        const formatCoord = (value) => typeof value === 'number' ? value.toFixed(1) : value;

        content += `
            <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                <span class="text-gray-400">Type:</span> <span class="text-white">${displayName}</span>
                <span class="text-gray-400">Role:</span> <span class="text-cyan-300">Packet Origin</span>
                <span class="text-gray-400">Links:</span> <span class="text-white">${connectionCount}</span>
                <span class="text-gray-400">Position:</span>
                <span class="text-white">(${formatCoord(position.x)}, ${formatCoord(position.z)})</span>
            </div>
            <div class="mt-1 pt-1 border-t border-gray-600 text-[9px] text-blue-300">${tip}</div>
        `;
    }

    tooltip.innerHTML = content;
}