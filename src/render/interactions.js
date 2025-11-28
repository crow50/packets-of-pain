import { camera, renderer, serviceGroup, connectionGroup, internetMesh } from "./scene.js";

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
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
        const connections = getEngine()?.getSimulation()?.connections || [];
        const link = connections.find(c => c.mesh === mesh);
        if (link) return { type: 'link', id: link.id, obj: mesh, link: link };
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
            const positions = link.mesh.geometry.attributes.position.array;
            positions[0] = from.position.x;
            positions[1] = 1;
            positions[2] = from.position.z;
            positions[3] = to.position.x;
            positions[4] = 1;
            positions[5] = to.position.z;
            link.mesh.geometry.attributes.position.needsUpdate = true;
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
                const loadPct = Math.round(svc.totalLoad * 100);
                const loadColor = loadPct > 80 ? 'text-red-400' : (loadPct > 50 ? 'text-yellow-400' : 'text-green-400');

                content += `
                    <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                        <span class="text-gray-400">Type:</span> <span class="text-white capitalize">${svc.type}</span>
                        <span class="text-gray-400">Tier:</span> <span class="text-white">${svc.tier || 1}</span>
                        <span class="text-gray-400">Load:</span> <span class="${loadColor}">${loadPct}%</span>
                        <span class="text-gray-400">Queue:</span> <span class="text-white">${svc.queue.length}/20</span>
                        <span class="text-gray-400">Proc:</span> <span class="text-white">${svc.processing.length}/${svc.config.capacity}</span>
                        <span class="text-gray-400">Links:</span> <span class="text-white">${svc.connections.length}</span>
                    </div>
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
