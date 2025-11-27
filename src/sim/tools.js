import { connectionGroup } from "../render/scene.js";

const TOOL_ID_MAP = {
    waf: 'tool-waf',
    loadBalancer: 'tool-lb',
    compute: 'tool-compute',
    database: 'tool-db',
    objectStorage: 'tool-objstore'
};

const getEntity = (id) => id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);

export function getToolId(toolName) {
    return TOOL_ID_MAP[toolName] || `tool-${toolName}`;
}

export function setTool(toolName) {
    STATE.activeTool = toolName;
    STATE.selectedNodeId = null;
    document.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'));
    const toolButton = document.getElementById(getToolId(toolName));
    if (toolButton) toolButton.classList.add('active');
    new Audio('assets/sounds/click-9.mp3').play();
}

function flashMoney() {
    const el = document.getElementById('money-display');
    if (!el) return;
    el.classList.add('text-red-500');
    setTimeout(() => el.classList.remove('text-red-500'), 300);
}

export { flashMoney };

window.flashMoney = flashMoney;

export function createService(type, pos) {
    const service = CONFIG.services[type];
    if (!service) return;
    if (STATE.money < service.cost) {
        flashMoney();
        return;
    }
    if (STATE.services.find(s => s.position.distanceTo(pos) < 1)) return;

    STATE.money -= service.cost;
    STATE.services.push(new Service(type, pos));
    STATE.sound.playPlace();
}

export function createConnection(fromId, toId) {
    if (fromId === toId) return;
    const from = getEntity(fromId);
    const to = getEntity(toId);
    if (!from || !to || from.connections.includes(toId)) return;

    new Audio('assets/sounds/click-5.mp3').play();

    from.connections.push(toId);
    to.connections.push(fromId);
    const pts = [from.position.clone(), to.position.clone()];
    pts[0].y = pts[1].y = 1;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: CONFIG.colors.line });
    const line = new THREE.Line(geo, mat);
    connectionGroup.add(line);

    const linkId = 'link_' + Math.random().toString(36).substr(2, 9);
    STATE.connections.push({ id: linkId, from: fromId, to: toId, mesh: line });
    STATE.sound.playConnect();
}

export function deleteLink(link) {
    if (!link) return;

    const fromNode = getEntity(link.from);
    if (fromNode) {
        fromNode.connections = fromNode.connections.filter(id => id !== link.to);
    }

    const toNode = getEntity(link.to);
    if (toNode) {
        toNode.connections = toNode.connections.filter(id => id !== link.from);
    }

    connectionGroup.remove(link.mesh);
    link.mesh.geometry.dispose();
    link.mesh.material.dispose();

    STATE.connections = STATE.connections.filter(c => c.id !== link.id);
    STATE.sound.playDelete();
}

export function deleteObject(id) {
    const svc = STATE.services.find(s => s.id === id);
    if (!svc) return;

    const linksToRemove = STATE.connections.filter(c => c.from === id || c.to === id);
    linksToRemove.forEach(link => deleteLink(link));

    svc.destroy();
    STATE.services = STATE.services.filter(s => s.id !== id);
    STATE.money += Math.floor(svc.config.cost / 2);
    STATE.sound.playDelete();
}
