import { connectionGroup } from "../render/scene.js";
import { resolveState, syncLegacyState } from "../core/stateBridge.js";

const TOOL_ID_MAP = {
    waf: 'tool-waf',
    loadBalancer: 'tool-lb',
    compute: 'tool-compute',
    database: 'tool-db',
    objectStorage: 'tool-objstore'
};

function getEntityFromState(state, id) {
    const sim = state.simulation || state;
    return id === 'internet' ? sim.internetNode : sim.services.find(s => s.id === id);
}

const getEntity = (id) => getEntityFromState(STATE, id);

export function getToolId(toolName) {
    return TOOL_ID_MAP[toolName] || `tool-${toolName}`;
}

export function setTool(toolName) {
    STATE.activeTool = toolName;
    STATE.selectedNodeId = null;

    const resolved = resolveState();
    const ui = resolved?.ui || resolved;
    if (ui) {
        ui.activeTool = toolName;
        ui.selectedNodeId = null;
        syncLegacyState(resolved);
    }

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

export function createService(arg1, arg2, arg3) {
    // Overload: createService(type, pos) OR createService(state, type, pos)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const type = hasState ? arg2 : arg1;
    const pos = hasState ? arg3 : arg2;

    const sim = state.simulation || state;
    const ui = state.ui || state;

    const serviceConfig = CONFIG.services[type];
    if (!serviceConfig) return;

    if (sim.money < serviceConfig.cost) {
        flashMoney();
        return;
    }
    if (sim.services.find(s => s.position.distanceTo(pos) < 1)) return;

    sim.money -= serviceConfig.cost;
    sim.services.push(new Service(type, pos));
    (ui.sound || STATE.sound)?.playPlace?.();
    syncLegacyState(state);
}

export function createConnection(arg1, arg2, arg3) {
    // Overload: createConnection(fromId, toId) OR createConnection(state, fromId, toId)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const fromId = hasState ? arg2 : arg1;
    const toId = hasState ? arg3 : arg2;

    if (fromId === toId) return;

    const sim = state.simulation || state;
    const ui = state.ui || state;

    const from = getEntityFromState(state, fromId);
    const to = getEntityFromState(state, toId);
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
    sim.connections.push({ id: linkId, from: fromId, to: toId, mesh: line });
    (ui.sound || STATE.sound)?.playConnect?.();
    syncLegacyState(state);
}

export function deleteLink(arg1, arg2) {
    // Overload: deleteLink(link) OR deleteLink(state, link)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const link = hasState ? arg2 : arg1;

    if (!link) return;

    const sim = state.simulation || state;
    const ui = state.ui || state;

    const fromNode = getEntityFromState(state, link.from);
    if (fromNode) {
        fromNode.connections = fromNode.connections.filter(id => id !== link.to);
    }

    const toNode = getEntityFromState(state, link.to);
    if (toNode) {
        toNode.connections = toNode.connections.filter(id => id !== link.from);
    }

    connectionGroup.remove(link.mesh);
    link.mesh.geometry.dispose();
    link.mesh.material.dispose();

    sim.connections = sim.connections.filter(c => c.id !== link.id);
    (ui.sound || STATE.sound)?.playDelete?.();
    syncLegacyState(state);
}

export function deleteObject(arg1, arg2) {
    // Overload: deleteObject(id) OR deleteObject(state, id)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const id = hasState ? arg2 : arg1;

    const sim = state.simulation || state;
    const ui = state.ui || state;

    const svc = sim.services.find(s => s.id === id);
    if (!svc) return;

    const linksToRemove = sim.connections.filter(c => c.from === id || c.to === id);
    linksToRemove.forEach(link => deleteLink(state, link));

    svc.destroy();
    sim.services = sim.services.filter(s => s.id !== id);
    sim.money += Math.floor(svc.config.cost / 2);
    (ui.sound || STATE.sound)?.playDelete?.();
    syncLegacyState(state);
}
