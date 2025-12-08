import Service from "../entities/Service.js";
import { distance, toPlainPosition } from "./vectorUtils.js";
import { DEFAULT_LINK_COST, upgradeConnectionFormat, createConnectionObject, hasConnection, removeConnections } from "./connectionUtils.js";
import { getServiceDef } from "../config/serviceCatalog.js";
import { validateTopology } from "../core/routing.js";
import { getRuntimeEngine } from "../utils/runtime.js";

let toolsEngine = null;
export function attachToolsEngine(engine) {
    toolsEngine = engine;
}

function getEngine() {
    return toolsEngine || getRuntimeEngine();
}

function resolveState(arg) {
    if (arg && (arg.simulation || arg.ui)) return arg;
    const engine = getEngine();
    return engine ? engine.getState() : null;
}

const TOOL_ID_MAP = {
    waf: 'tool-waf',
    loadBalancer: 'tool-loadBalancer',
    compute: 'tool-compute',
    database: 'tool-database',
    objectStorage: 'tool-objectStorage',
    modem: 'tool-modem',
    firewall: 'tool-firewall',
    switch: 'tool-switch'
};

function getEntityFromState(state, id) {
    const sim = state.simulation || state;
    return id === 'internet' ? sim.internetNode : sim.services.find(s => s.id === id);
}

const getEntity = (id) => {
    const state = resolveState();
    return state ? getEntityFromState(state, id) : null;
};

function emit(event, payload) {
    const engine = getEngine();
    engine?.emit?.(event, payload);
}

export function getToolId(toolName) {
    return TOOL_ID_MAP[toolName] || `tool-${toolName}`;
}

export function setTool(toolName) {
    const engine = getEngine();
    engine?.setActiveTool(toolName);
    engine?.setSelectedNode(null);
    engine?.emit?.('toolChanged', { toolName });
}

function flashMoney() {
    const engine = getEngine();
    engine?.emit?.('budgetWarning', { reason: 'insufficientFunds' });
}

export { flashMoney };

export function createService(arg1, arg2, arg3) {
    // Overload: createService(type, pos) OR createService(state, type, pos)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const type = hasState ? arg2 : arg1;
    const pos = hasState ? arg3 : arg2;
    const plainPos = toPlainPosition(pos);

    if (!state) return;
    const sim = state.simulation || state;

    // Use service catalog as single source of truth
    const catalogEntry = getServiceDef(type);
    if (!catalogEntry || catalogEntry.drawable === false) return;
    const baseCost = catalogEntry.baseCost;

    if (sim.money < baseCost) {
        flashMoney();
        return;
    }
    if (sim.services.find(s => distance(s.position, plainPos) < 1)) return;

    sim.money -= baseCost;
    const serviceEntity = new Service(type, plainPos);
    sim.services.push(serviceEntity);
    emit('serviceAdded', {
        serviceId: serviceEntity.id,
        kind: serviceEntity.kind,
        position: toPlainPosition(serviceEntity.position)
    });
    
    // Validate topology after adding service
    validateTopology(state);
}

export function createConnection(arg1, arg2, arg3, arg4) {
    // Overload: createConnection(fromId, toId, options) OR createConnection(state, fromId, toId, options)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const fromId = hasState ? arg2 : arg1;
    const toId = hasState ? arg3 : arg2;
    const options = hasState ? arg4 : arg3;

    if (fromId === toId) return;
    if (!state) return;

    const sim = state.simulation || state;

    const from = getEntityFromState(state, fromId);
    const to = getEntityFromState(state, toId);
    if (!from || !to || hasConnection(from, toId)) return;

    const bidirectional = options?.bidirectional !== false;
    const linkCost = typeof options?.linkCost === 'number' ? options.linkCost : DEFAULT_LINK_COST;
    const linkId = options?.linkId || ('link_' + Math.random().toString(36).substr(2, 9));

    const forwardConnection = createConnectionObject(toId, {
        bidirectional,
        linkCost,
        linkId,
        portRole: 'designated',
        active: true
    });
    if (forwardConnection) {
        upgradeConnectionFormat(from);
        from.connections.push(forwardConnection);
    }

    if (bidirectional) {
        const reverseConnection = createConnectionObject(fromId, {
            bidirectional,
            linkCost,
            linkId,
            portRole: 'designated',
            active: true
        });
        if (reverseConnection) {
            upgradeConnectionFormat(to);
            to.connections.push(reverseConnection);
        }
    }

    sim.connections.push({ id: linkId, from: fromId, to: toId, bidirectional, linkCost });
    emit('connectionCreated', { linkId, from: fromId, to: toId, bidirectional });
    
    // Validate topology after adding connection
    validateTopology(state);
}

export function deleteLink(arg1, arg2) {
    // Overload: deleteLink(link) OR deleteLink(state, link)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const link = hasState ? arg2 : arg1;

    if (!link || !state) return;

    const sim = state.simulation || state;

    const fromNode = getEntityFromState(state, link.from);
    if (fromNode) {
        removeConnections(fromNode, conn => conn.linkId === link.id || conn.targetId === link.to);
    }

    const toNode = getEntityFromState(state, link.to);
    if (toNode) {
        removeConnections(toNode, conn => conn.linkId === link.id || conn.targetId === link.from);
    }

    sim.connections = sim.connections.filter(c => c.id !== link.id);
    emit('connectionDeleted', { linkId: link.id });
    
    // Validate topology after removing connection
    validateTopology(state);
}

export function deleteObject(arg1, arg2) {
    // Overload: deleteObject(id) OR deleteObject(state, id)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const id = hasState ? arg2 : arg1;

    if (!state) return;
    const sim = state.simulation || state;

    const svc = sim.services.find(s => s.id === id);
    if (!svc) return;

    const linksToRemove = sim.connections.filter(c => c.from === id || c.to === id);
    linksToRemove.forEach(link => deleteLink(state, link));

    svc.destroy();
    sim.services = sim.services.filter(s => s.id !== id);
    sim.money += Math.floor(svc.config.cost / 2);
    emit('serviceRemoved', { serviceId: id });
    
    // Validate topology after removing service
    validateTopology(state);
}
