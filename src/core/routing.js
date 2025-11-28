/**
 * routing.js - Catalog-driven packet routing
 * 
 * Uses SERVICE_TYPES accepts/terminalFor/blocks to determine routing
 * instead of hard-coded service chains.
 */

// Access catalog via window.ServiceCatalog to avoid redeclaring globals
function _catalog() {
    return window.ServiceCatalog;
}

function _getServiceType(key) {
    return _catalog()?.getServiceType?.(key);
}

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

function getServiceEntity(id) {
    const sim = getEngine()?.getSimulation();
    if (!sim) return null;
    return id === 'internet' ? sim.internetNode : sim.services.find(s => s.id === id);
}

/**
 * Get neighbors of a service node
 */
function getNeighbors(service) {
    if (!service || !service.connections) return [];
    return service.connections
        .map(getServiceEntity)
        .filter(Boolean);
}

/**
 * Check if traffic type is blocked by this service
 */
function isBlocked(serviceDef, trafficType) {
    return serviceDef?.blocks?.includes(trafficType) ?? false;
}

/**
 * Check if this service is a terminal node for this traffic type
 */
function isTerminal(serviceDef, trafficType) {
    return serviceDef?.terminalFor?.includes(trafficType) ?? false;
}

/**
 * Check if this service accepts this traffic type
 */
function accepts(serviceDef, trafficType) {
    return serviceDef?.accepts?.includes(trafficType) ?? false;
}

/**
 * Get queue penalty based on current load
 */
function getQueuePenalty(node) {
    if (!node || !Array.isArray(node.queue)) return 0;
    const capacity = node.config?.capacity || 1;
    const load = (node.queue.length + (node.processing?.length || 0)) / capacity;
    return load * 20; // Higher penalty for congestion
}

/**
 * Check if there's a path to any terminal node for this traffic type
 */
function hasTerminalPath(node, trafficType, depth = 4, visited = new Set()) {
    if (!node || depth < 0) return false;
    
    const nodeDef = _getServiceType(node.type);
    if (isTerminal(nodeDef, trafficType)) return true;
    
    visited.add(node.id);
    
    for (const nextId of (node.connections || [])) {
        if (nextId === 'internet') continue;
        const nextNode = getServiceEntity(nextId);
        if (!nextNode || visited.has(nextNode.id)) continue;
        
        // Only follow nodes that accept this traffic
        const nextDef = _getServiceType(nextNode.type);
        if (!accepts(nextDef, trafficType)) continue;
        
        if (hasTerminalPath(nextNode, trafficType, depth - 1, new Set(visited))) {
            return true;
        }
    }
    
    return false;
}

/**
 * Compute routing score for a candidate neighbor
 */
function computeRoutingScore(neighbor, request, currentService) {
    const neighborDef = _getServiceType(neighbor.type);
    if (!neighborDef) return -1000;
    
    let score = 0;
    
    // Strong preference for nodes that accept this traffic type
    if (accepts(neighborDef, request.type)) {
        score += 50;
    } else {
        return -1000; // Don't route to nodes that don't accept this traffic
    }
    
    // Bonus for terminal nodes when traffic is ready
    if (isTerminal(neighborDef, request.type)) {
        // Extra bonus if we've been through compute (for WEB/API)
        if (request.hasCompute) {
            score += 150;
        } else {
            // Still good, but prefer going through compute first
            score += 30;
        }
    }
    
    // Bonus for compute nodes if we haven't processed yet
    if (neighbor.type === 'compute' && !request.hasCompute) {
        score += 80;
    }
    
    // Bonus for load balancers (routing layer)
    if (neighbor.type === 'loadBalancer') {
        score += 40;
    }
    
    // Check if this neighbor leads to a terminal
    const visited = new Set();
    if (currentService?.id) visited.add(currentService.id);
    if (request.lastNodeId) visited.add(request.lastNodeId);
    
    if (hasTerminalPath(neighbor, request.type, 3, visited)) {
        score += 60;
    } else {
        score -= 40; // Penalize dead ends
    }
    
    // Penalize congestion
    score -= getQueuePenalty(neighbor);
    
    // Small penalty for highly connected nodes (spread load)
    score -= (neighbor.connections?.length || 0) * 0.5;
    
    return score;
}

/**
 * Choose best neighbor from candidates using weighted random selection
 */
function chooseNeighbor(candidates, request, currentService) {
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    
    const scored = candidates.map(node => ({
        node,
        score: computeRoutingScore(node, request, currentService)
    }));
    
    // Filter out negative scores (invalid routes)
    const valid = scored.filter(s => s.score > -100);
    if (!valid.length) return null;
    
    // Find best score
    const maxScore = Math.max(...valid.map(s => s.score));
    
    // Select from top candidates (within 10 points of best)
    const EPS = 10;
    const topCandidates = valid
        .filter(s => s.score >= maxScore - EPS)
        .map(s => s.node);
    
    // Random selection among top candidates
    return topCandidates[Math.floor(Math.random() * topCandidates.length)] || null;
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
    const serviceDef = _getServiceType(currentService.type);
    if (!serviceDef) {
        return { action: 'DEAD_END' };
    }
    
    // 1. Check if this traffic is blocked here
    if (isBlocked(serviceDef, request.type)) {
        return { action: 'BLOCK' };
    }
    
    // 2. Check if this is a terminal node for this traffic type
    if (isTerminal(serviceDef, request.type)) {
        return { action: 'TERMINATE' };
    }
    
    // 3. Get neighbors, excluding where we came from
    const neighbors = getNeighbors(currentService)
        .filter(n => n.id !== request.lastNodeId && n.id !== 'internet');
    
    if (!neighbors.length) {
        return { action: 'DEAD_END' };
    }
    
    // 4. Filter to nodes that accept this traffic type
    const candidates = neighbors.filter(node => {
        const def = _getServiceType(node.type);
        return accepts(def, request.type);
    });
    
    if (!candidates.length) {
        return { action: 'DEAD_END' };
    }
    
    // 5. Choose best neighbor
    const next = chooseNeighbor(candidates, request, currentService);
    if (!next) {
        return { action: 'DEAD_END' };
    }
    
    return { action: 'FORWARD', nodeId: next.id, node: next };
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

// Expose globally for non-module scripts
if (typeof window !== 'undefined') {
    window.Routing = {
        getNextHop,
        getRoutingInfo,
        getServiceTrafficSummary,
        isBlocked,
        isTerminal,
        accepts,
        hasTerminalPath,
        getNeighbors
    };
}
