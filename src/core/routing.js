/**
 * routing.js - Catalog-driven packet routing
 * 
 * Uses SERVICE_TYPES accepts/terminalFor/blocks to determine routing
 * instead of hard-coded service chains.
 */

const CONNECTION_UTILS = typeof window !== 'undefined' ? (window.ConnectionUtils || {}) : {};
const CONGESTION_THRESHOLD = 0.85;
const listConnections = CONNECTION_UTILS.listConnections || function(node, options = {}) {
    const includeInactive = options.includeInactive ?? false;
    const connections = Array.isArray(node?.connections) ? node.connections : [];
    return connections
        .map(conn => {
            if (typeof conn === 'string') {
                return { targetId: conn, bidirectional: true, active: true };
            }
            return conn;
        })
        .filter(conn => conn && (includeInactive || conn.active !== false));
};

const getConnectionTargets = CONNECTION_UTILS.getConnectionTargets || function(node, options = {}) {
    return listConnections(node, options).map(conn => conn.targetId);
};

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine || null;
}

function getSimulationFromState(state) {
    if (state?.simulation) {
        return state.simulation;
    }
    if (state?.services || state?.internetNode) {
        return state;
    }
    return getEngine()?.getSimulation?.() || null;
}

function getServiceById(state, serviceId) {
    const simulation = getSimulationFromState(state);
    if (!simulation || !serviceId) return null;
    if (serviceId === 'internet') {
        return simulation.internetNode || null;
    }
    return simulation.services?.find(service => service.id === serviceId) || null;
}

function getServiceEntity(serviceId) {
    return getServiceById(getEngine()?.getState?.(), serviceId);
}

function getNeighborsFromState(state, service) {
    if (!service) return [];
    const simulation = getSimulationFromState(state);
    if (!simulation) return [];
    return listConnections(service)
        .map(conn => (conn.targetId === 'internet'
            ? simulation.internetNode
            : simulation.services?.find(s => s.id === conn.targetId)))
        .filter(Boolean);
}

function getNeighbors(service) {
    const engineState = getEngine()?.getState?.();
    return getNeighborsFromState(engineState, service);
}

function getCatalogEntry(serviceType) {
    return window.ServiceCatalog?.getServiceType?.(serviceType) || null;
}

function accepts(definition, trafficType) {
    if (!definition || !trafficType) return false;
    return Array.isArray(definition.accepts) && definition.accepts.includes(trafficType);
}

function isBlocked(definition, trafficType) {
    if (!definition || !trafficType) return false;
    return Array.isArray(definition.blocks) && definition.blocks.includes(trafficType);
}

function isTerminal(definition, trafficType) {
    if (!definition || !trafficType) return false;
    return Array.isArray(definition.terminalFor) && definition.terminalFor.includes(trafficType);
}

function evaluateCatalogRules(serviceDef, request) {
    if (!serviceDef || !request) {
        return null;
    }
    const trafficType = request.type;
    if (isBlocked(serviceDef, trafficType)) {
        return { action: 'BLOCK' };
    }
    if (!accepts(serviceDef, trafficType)) {
        return { action: 'DEAD_END' };
    }
    if (isTerminal(serviceDef, trafficType)) {
        return { action: 'TERMINATE' };
    }
    return null;
}

function isStpRoutingEnabled(state) {
    const simulation = getSimulationFromState(state);
    const flag = simulation?.routing?.featureFlags?.enableStpRouting;
    if (typeof flag === 'boolean') {
        return flag;
    }
    return Boolean(window.CONFIG?.routing?.enableStpRouting);
}

function getSpanningTree(state) {
    const simulation = getSimulationFromState(state);
    if (simulation?.routing?.spanningTree) {
        return simulation.routing.spanningTree;
    }
    const engineState = getEngine()?.getState?.();
    return engineState?.simulation?.routing?.spanningTree || null;
}

function getForwardingTableRow(tree, nodeId) {
    if (!tree || !nodeId) {
        return null;
    }
    const tables = tree.forwardingTables;
    if (!tables) {
        return null;
    }
    if (tables instanceof Map) {
        return tables.get(nodeId) || null;
    }
    return tables[nodeId] || null;
}

function _getServiceType(key) {
    return getCatalogEntry(key);
}

function getForwardingValue(row, destinationId) {
    if (!row || !destinationId) {
        return null;
    }
    if (row instanceof Map) {
        return row.get(destinationId) ?? null;
    }
    return row[destinationId] ?? null;
}

function getForwardingNextHop(tree, currentId, destinationId) {
    const row = getForwardingTableRow(tree, currentId);
    if (!row) return null;
    return getForwardingValue(row, destinationId);
}

function getServiceLoad(service) {
    if (!service) return Infinity;
    const queueLength = Array.isArray(service.queue) ? service.queue.length : 0;
    const processing = Array.isArray(service.processing) ? service.processing.length : 0;
    const capacity = service.config?.capacity || 1;
    return (queueLength + processing) / capacity;
}

function isServiceCongested(service) {
    if (!service) return false;
    return getServiceLoad(service) >= CONGESTION_THRESHOLD;
}

function findAlternateNextHop(state, tree, request, currentService, destination, congestedService) {
    const neighborConnections = listConnections(currentService);
    if (!neighborConnections.length) {
        return null;
    }
    for (const connection of neighborConnections) {
        const neighborId = connection.targetId;
        if (neighborId === congestedService?.id || neighborId === 'internet') {
            continue;
        }
        if (neighborId === request?.lastNodeId) {
            continue;
        }
        const neighbor = getServiceById(state, neighborId);
        if (!neighbor) continue;
        const def = getCatalogEntry(neighbor.type);
        if (!accepts(def, request.type)) continue;
        const neighborNextHop = getForwardingNextHop(tree, neighbor.id, destination.id);
        if (!neighborNextHop || neighborNextHop === currentService.id) continue;
        if (isServiceCongested(neighbor)) continue;
        return neighbor;
    }
    return null;
}

function findTerminalNode(state, trafficType) {
    const simulation = state?.simulation;
    if (!simulation?.services?.length) {
        return null;
    }

    return simulation.services.find(service => {
        const definition = getCatalogEntry(service.type);
        return isTerminal(definition, trafficType);
    }) || null;
}

function getNextHopViaSpanningTree(state, request, currentService) {
    if (!state || !request || !currentService) {
        return null;
    }

    const tree = getSpanningTree(state);
    if (!tree?.forwardingTables) {
        return null;
    }

    const destination = findTerminalNode(state, request.type);
    if (!destination) {
        return null;
    }

    const nextHopId = getForwardingNextHop(tree, currentService.id, destination.id);
    if (!nextHopId) {
        return null;
    }

    const nextService = getServiceById(state, nextHopId);
    if (!nextService) {
        return null;
    }

    const nextDef = getCatalogEntry(nextService.type);
    if (!accepts(nextDef, request.type)) {
        return null;
    }

    if (isServiceCongested(nextService)) {
        const alternate = findAlternateNextHop(state, tree, request, currentService, destination, nextService);
        if (alternate) {
            return { action: 'FORWARD', nodeId: alternate.id, node: alternate };
        }
    }

    return { action: 'FORWARD', nodeId: nextService.id, node: nextService };
}

/**
 * Compute routing score for a candidate neighbor
 */
function getNextHopViaLegacyRouting(state, request, currentService) {
    const neighbors = getNeighborsFromState(state, currentService)
        .filter(n => n.id !== request?.lastNodeId && n.id !== 'internet');

    if (!neighbors.length) {
        return { action: 'DEAD_END' };
    }

    const candidates = neighbors.filter(node => {
        const def = getCatalogEntry(node.type);
        return accepts(def, request?.type);
    });

    if (!candidates.length) {
        return { action: 'DEAD_END' };
    }

    let best = null;
    let lowestLoad = Infinity;
    for (const candidate of candidates) {
        const load = getServiceLoad(candidate);
        if (load < lowestLoad) {
            lowestLoad = load;
            best = candidate;
        }
    }

    if (!best) {
        return { action: 'DEAD_END' };
    }

    return { action: 'FORWARD', nodeId: best.id, node: best };
}

function hasPathMatchingCriteria(startNode, trafficType, predicate, depthLimit = 6) {
    if (!startNode) return false;
    const visited = new Set([startNode.id]);
    const queue = [{ node: startNode, depth: 0 }];

    while (queue.length) {
        const { node, depth } = queue.shift();
        const nodeDef = _getServiceType(node.type);
        if (predicate(nodeDef, node)) {
            return true;
        }
        if (depth >= depthLimit) continue;
        const neighbors = listConnections(node);
        for (const connection of neighbors) {
            const nextId = connection.targetId;
            if (nextId === 'internet' || visited.has(nextId)) continue;
            const nextNode = getServiceEntity(nextId);
            if (!nextNode) continue;
            const nextDef = _getServiceType(nextNode.type);
            if (!accepts(nextDef, trafficType)) continue;
            visited.add(nextId);
            queue.push({ node: nextNode, depth: depth + 1 });
        }
    }

    return false;
}

function hasTerminalPathLegacy(node, trafficType, depthLimit = 6) {
    return hasPathMatchingCriteria(node, trafficType, def => isTerminal(def, trafficType), depthLimit);
}

function hasPathToBlockerLegacy(node, trafficType, depthLimit = 6) {
    return hasPathMatchingCriteria(node, trafficType, def => isBlocked(def, trafficType), depthLimit);
}

/**
 * Main routing function - determines next hop for a request
 * 
 * @param {Object} state - Game state
 * @param {Object} request - The request being routed
 * @param {Object} currentService - The service currently processing the request
 * @returns {Object} { action: "TERMINATE"|"BLOCK"|"FORWARD"|"DEAD_END", nodeId?: string }
 */
function getNextHop(state, request, currentService) {
    if (!request || !currentService) {
        return { action: 'DEAD_END' };
    }

    const serviceDef = getCatalogEntry(currentService.type);
    const catalogDecision = evaluateCatalogRules(serviceDef, request);
    if (catalogDecision) {
        return catalogDecision;
    }

    if (isStpRoutingEnabled(state)) {
        const stpDecision = getNextHopViaSpanningTree(state, request, currentService);
        if (stpDecision) {
            return stpDecision;
        }
    }

    return getNextHopViaLegacyRouting(state, request, currentService);
}

/**
 * Get routing info for UI display
 */
function getRoutingInfo(serviceType, trafficType) {
    const def = _getServiceType(serviceType);
    if (!def) return null;
    
    return {
        accepts: accepts(def, trafficType),
        blocks: isBlocked(def, trafficType),
        terminal: isTerminal(def, trafficType)
    };
}

/**
 * Get all traffic types a service handles
 */
function getServiceTrafficSummary(serviceType) {
    const def = _getServiceType(serviceType);
    if (!def) return null;
    
    return {
        accepts: def.accepts || [],
        blocks: def.blocks || [],
        terminalFor: def.terminalFor || []
    };
}

/**
 * Validate topology - check if there are valid paths for each traffic type
 * Call this after placing/removing services or links
 * 
 * @returns {Object} { web: boolean, api: boolean, fraud: boolean, warnings: string[] }
 */
function validateTopology() {
    const engine = getEngine();
    const sim = engine?.getSimulation();
    if (!sim || !sim.internetNode) {
        return { web: false, api: false, fraud: false, warnings: ['No simulation state'] };
    }
    
    const warnings = [];
    const internetNode = sim.internetNode;
    
    // Check WEB traffic path (needs to reach objectStorage)
    const internetTargets = getConnectionTargets(internetNode);

    const hasWebPath = internetTargets.some(connId => {
        const node = getServiceEntity(connId);
        if (!node) return false;
        const nodeDef = _getServiceType(node.type);
        if (!accepts(nodeDef, 'WEB')) return false;
        return hasTerminalPathLegacy(node, 'WEB', 6);
    });
    
    // Check API traffic path (needs to reach database)
    const hasApiPath = internetTargets.some(connId => {
        const node = getServiceEntity(connId);
        if (!node) return false;
        const nodeDef = _getServiceType(node.type);
        if (!accepts(nodeDef, 'API')) return false;
        return hasTerminalPathLegacy(node, 'API', 6);
    });
    
    // Check FRAUD traffic path (needs at least one blocking-capable node)
    const hasFraudBlocker = sim.services.some(svc => {
        const def = _getServiceType(svc.type);
        return def?.blocks?.includes('FRAUD');
    });
    
    // Check if fraud blockers are reachable from internet
    const fraudBlockerReachable = hasFraudBlocker && internetTargets.some(connId => {
        const node = getServiceEntity(connId);
        if (!node) return false;
        const nodeDef = _getServiceType(node.type);
        if (nodeDef?.blocks?.includes('FRAUD')) return true;
        return hasPathToBlockerLegacy(node, 'FRAUD', 6);
    });
    
    if (!hasWebPath) {
        warnings.push('No valid path for WEB traffic – packets will fail');
    }
    if (!hasApiPath) {
        warnings.push('No valid path for API traffic – packets will fail');
    }
    if (!hasFraudBlocker) {
        warnings.push('No WAF or Firewall to block FRAUD traffic');
    } else if (!fraudBlockerReachable) {
        warnings.push('FRAUD blocker not reachable from internet');
    }

    const userExposed = sim.services.some(service => {
        if (!service) return false;
        const def = _getServiceType(service.type);
        const isUser = def?.key?.toLowerCase?.() === 'user' || String(service.type).toLowerCase() === 'user';
        if (!isUser) return false;
        return getConnectionTargets(service).includes('internet');
    });
    if (userExposed) {
        warnings.push('User node connected directly to the Internet – exposed to MALICIOUS traffic');
    }
    
    // Store warnings in sim state for HUD to display
    sim.topologyWarnings = {
        web: !hasWebPath,
        api: !hasApiPath,
        fraud: !fraudBlockerReachable,
        warnings: warnings
    };
    
    return {
        web: hasWebPath,
        api: hasApiPath,
        fraud: fraudBlockerReachable,
        warnings
    };
}

/**
 * Get the most loaded service for HUD display
 */
function getMostLoadedService() {
    const engine = getEngine();
    const sim = engine?.getSimulation();
    if (!sim?.services?.length) return null;
    
    let mostLoaded = null;
    let highestUtil = 0;
    
    for (const svc of sim.services) {
        const util = svc.load?.utilization ?? 0;
        if (util > highestUtil) {
            highestUtil = util;
            mostLoaded = svc;
        }
    }
    
    return mostLoaded ? {
        service: mostLoaded,
        utilization: highestUtil,
        displayName: _getServiceType(mostLoaded.type)?.label || mostLoaded.type
    } : null;
}

// Expose globally for non-module scripts
if (typeof window !== 'undefined') {
    window.Routing = {
        getNextHop,
        getRoutingInfo,
        getServiceTrafficSummary,
        isBlocked,
        isTerminal,
        accepts,
        getNeighbors,
        validateTopology,
        getMostLoadedService
    };
}
