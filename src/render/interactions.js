import { camera, renderer, serviceGroup, connectionGroup, internetMesh } from "./scene.js";
import { updateConnectionGeometry } from "./connectionManager.js";

const { getServiceType, getCapacityForTier } = window.ServiceCatalog;

// Module-level engine reference, set via init()
let _engine = null;

/**
 * Initialize interactions module with engine reference
 * @param {object} engine - The game engine instance
 */
export function init(engine) {
    _engine = engine;
}

// Fallback for backwards compatibility during transition
function getEngine() {
    return _engine || window.__POP_RUNTIME__?.current?.engine;
}

export let raycaster;
export let mouse;
export let plane;

export function initInteractions() {
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
}

export function getIntersect(clientX, clientY) {
    if (!raycaster || !mouse || !plane) return null;
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(serviceGroup.children, true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && obj.parent !== serviceGroup) obj = obj.parent;
        return { type: 'service', id: obj.userData.id, obj: obj };
    }

    raycaster.params.Line.threshold = 1;
    const linkIntersects = raycaster.intersectObjects(connectionGroup.children, true);
    if (linkIntersects.length > 0) {
        const mesh = linkIntersects[0].object;
        const linkId = mesh.userData?.linkId;
        if (linkId) {
            const connections = getEngine()?.getSimulation()?.connections || [];
            const link = connections.find(c => c.id === linkId);
            if (link) return { type: 'link', id: link.id, obj: mesh, link };
        }
    }

    const intInter = internetMesh ? raycaster.intersectObject(internetMesh) : [];
    if (intInter.length > 0) return { type: 'internet', id: 'internet', obj: internetMesh };

    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return { type: 'ground', pos: target };
}

export function snapToGrid(vec) {
    const s = CONFIG.tileSize;
    return new THREE.Vector3(
        Math.round(vec.x / s) * s,
        0,
        Math.round(vec.z / s) * s
    );
}

export function updateLinkVisuals(nodeId) {
    const sim = getEngine()?.getSimulation();
    if (!sim) return;
    const links = sim.connections.filter(c => c.from === nodeId || c.to === nodeId);
    links.forEach(link => {
        const getEntity = (id) => id === 'internet' ? sim.internetNode : sim.services.find(s => s.id === id);
        const from = getEntity(link.from);
        const to = getEntity(link.to);

        if (from && to) {
            updateConnectionGeometry(link.id, from.position, to.position);
        }
    });
}

export function updateTooltip() {
    const tooltip = document.getElementById('tooltip');
    const engine = getEngine();
    const hovered = engine?.getUIState()?.hovered;
    if (!tooltip || !hovered || tooltip.style.display === 'none') return;

    const sim = engine?.getSimulation();
    const i = hovered;
    if (i.type === 'service' || i.type === 'link') {
        const id = i.id;
        let content = `<div class="font-bold border-b border-gray-500 pb-1 mb-1 text-xs">${id}</div>`;

        if (i.type === 'service') {
            const svc = sim?.services?.find(s => s.id === id);
            if (svc) {
                // Get display info from service catalog
                const catalogEntry = getServiceType(svc.type);
                const displayName = catalogEntry?.label ?? svc.config?.name ?? svc.type;
                const upkeep = catalogEntry?.upkeepPerTick ?? svc.config?.upkeep ?? 0;
                const processingTime = catalogEntry?.processingTime ?? svc.config?.processingTime ?? 100;
                const capacity = getCapacityForTier(svc.type, svc.tier || 1);
                const maxTiers = catalogEntry?.tiers?.length || 1;
                
                // Use load.utilization for accurate load display
                const utilization = svc.load?.utilization ?? 0;
                const loadPct = Math.round(utilization * 100);
                const loadColor = loadPct > 80 ? 'text-red-400' : (loadPct > 50 ? 'text-yellow-400' : 'text-green-400');
                const dropped = svc.load?.dropped ?? 0;

                // Build traffic handling summary
                const accepts = catalogEntry?.accepts?.join(', ') || 'All';
                const blocks = catalogEntry?.blocks?.length ? catalogEntry.blocks.join(', ') : 'None';
                const terminalFor = catalogEntry?.terminalFor?.length ? catalogEntry.terminalFor.join(', ') : 'None';
                const tip = catalogEntry?.tip || null;

                content += `
                    <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                        <span class="text-gray-400">Type:</span> <span class="text-white capitalize">${displayName}</span>
                        <span class="text-gray-400">Tier:</span> <span class="text-white">${svc.tier || 1}/${maxTiers}</span>
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
        } else if (i.type === 'link') {
            const link = i.link;
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
        }

        tooltip.innerHTML = content;
    }
}
