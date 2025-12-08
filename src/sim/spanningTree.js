import { listConnections, DEFAULT_LINK_COST } from "./connectionUtils.js";

const CONGESTION_WEIGHT = 2;
const DEBOUNCE_MS = 120;

function getAllNodes(simulation) {
    const nodes = new Map();
    if (simulation?.internetNode?.id) {
        nodes.set(simulation.internetNode.id, simulation.internetNode);
    }
    (simulation?.services || []).forEach(service => {
        if (service?.id) {
            nodes.set(service.id, service);
        }
    });
    return nodes;
}

function ensureAdjacency(nodes) {
    const adjacency = new Map();
    nodes.forEach((_, nodeId) => {
        adjacency.set(nodeId, new Set());
    });

    nodes.forEach((node, nodeId) => {
        listConnections(node).forEach(conn => {
            const targetId = conn.targetId;
            if (!nodes.has(targetId) || targetId === nodeId) {
                return;
            }
            adjacency.get(nodeId)?.add(targetId);
            if (conn.bidirectional) {
                if (!adjacency.has(targetId)) {
                    adjacency.set(targetId, new Set());
                }
                adjacency.get(targetId)?.add(nodeId);
            }
        });
    });

    return adjacency;
}

function computeNodeCongestion(node) {
    if (!node) return 0;
    const queue = Array.isArray(node.queue) ? node.queue.length : 0;
    const processing = Array.isArray(node.processing) ? node.processing.length : 0;
    const capacity = node.config?.capacity || 1;
    const utilization = (queue + processing) / capacity;
    return Math.max(0, utilization);
}

export function computeLinkCost(nodeA, nodeB) {
    if (!nodeA || !nodeB) {
        return DEFAULT_LINK_COST;
    }
    const congestionPenalty = (computeNodeCongestion(nodeA) + computeNodeCongestion(nodeB)) * CONGESTION_WEIGHT;
    return DEFAULT_LINK_COST + congestionPenalty;
}

function mapToPlainObject(map, deep = false) {
    if (!(map instanceof Map)) {
        return map || {};
    }
    const obj = Object.create(null);
    for (const [key, value] of map.entries()) {
        obj[key] = deep && value instanceof Map
            ? mapToPlainObject(value, deep)
            : value;
    }
    return obj;
}

function dijkstra(rootId, adjacency, nodes) {
    const distances = new Map();
    const parents = new Map();
    const visited = new Set();

    distances.set(rootId, 0);
    const queue = [{ id: rootId, cost: 0 }];

    while (queue.length) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();
        if (!current || visited.has(current.id)) {
            continue;
        }
        visited.add(current.id);

        const neighbors = adjacency.get(current.id);
        if (!neighbors) continue;

        neighbors.forEach(neighborId => {
            if (visited.has(neighborId)) {
                return;
            }
            const neighborNode = nodes.get(neighborId);
            const currentNode = nodes.get(current.id);
            if (!neighborNode || !currentNode) {
                return;
            }
            const nextCost = current.cost + computeLinkCost(currentNode, neighborNode);
            const existingCost = distances.get(neighborId);
            if (existingCost === undefined || nextCost < existingCost) {
                distances.set(neighborId, nextCost);
                parents.set(neighborId, current.id);
                queue.push({ id: neighborId, cost: nextCost });
            }
        });
    }

    return { distances, parents, reachable: visited };
}

function buildForwardingRow(sourceId, adjacency, reachable) {
    const row = new Map();
    const visited = new Set([sourceId]);
    const queue = [sourceId];
    const firstHop = new Map();

    while (queue.length) {
        const currentId = queue.shift();
        const neighbors = adjacency.get(currentId);
        if (!neighbors) continue;
        neighbors.forEach(neighborId => {
            if (!reachable.has(neighborId) || visited.has(neighborId)) {
                return;
            }
            visited.add(neighborId);
            queue.push(neighborId);
            const hop = currentId === sourceId ? neighborId : (firstHop.get(currentId) ?? neighborId);
            firstHop.set(neighborId, hop);
        });
    }

    firstHop.forEach((hop, destinationId) => {
        if (destinationId === sourceId || !hop) {
            return;
        }
        row.set(destinationId, hop);
    });

    return row;
}

function buildForwardingTables(adjacency, reachable) {
    const tables = new Map();
    reachable.forEach(nodeId => {
        tables.set(nodeId, buildForwardingRow(nodeId, adjacency, reachable));
    });
    return tables;
}

export function buildSpanningTree(simulation) {
    const nodes = getAllNodes(simulation);
    const internetNode = simulation?.internetNode;
    if (!internetNode || !nodes.size) {
        return null;
    }

    const adjacency = ensureAdjacency(nodes);
    const { distances, parents, reachable } = dijkstra(internetNode.id, adjacency, nodes);

    const forwardingTables = buildForwardingTables(adjacency, reachable);
    const unreachableNodes = Array.from(nodes.keys()).filter(id => !reachable.has(id));

    return {
        rootId: internetNode.id,
        generatedAt: Date.now(),
        reachableNodes: Array.from(reachable),
        unreachableNodes,
        distances: mapToPlainObject(distances),
        parents: mapToPlainObject(parents),
        forwardingTables: mapToPlainObject(forwardingTables, true)
    };
}

/**
 * @deprecated STP is now always enabled - this function always returns true
 * Kept for backward compatibility
 * 
 * @test Should always return true (STP always enabled)
 * @test Legacy code paths checking this flag should still work
 */
function shouldBuild(state) {
    return true;
}

function ensureRoutingState(state) {
    if (!state?.simulation) {
        return null;
    }
    if (!state.simulation.routing) {
        state.simulation.routing = {
            spanningTree: null,
            topologyRevision: 0
        };
    }
    return state.simulation.routing;
}

export function initSpanningTreeManager(engine) {
    if (!engine) {
        return () => {};
    }

    const disposers = [];
    let debounceTimer = null;
    let disposed = false;

    const schedule = (reason) => {
        if (disposed) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => rebuild(reason), DEBOUNCE_MS);
    };

    const rebuild = (reason) => {
        const state = engine.getState();
        const routingState = ensureRoutingState(state);
        if (!routingState) return;

        if (!shouldBuild(state)) {
            routingState.spanningTree = null;
            return;
        }

        const tree = buildSpanningTree(state.simulation);
        routingState.spanningTree = tree;
        routingState.topologyRevision = (routingState.topologyRevision || 0) + 1;
        engine.emit?.('pop-sim:topologyUpdated', { tree, reason });
    };

    ['serviceAdded', 'serviceRemoved', 'connectionCreated', 'connectionDeleted'].forEach(eventName => {
        const unsub = engine.on?.(eventName, () => schedule(eventName));
        if (typeof unsub === 'function') {
            disposers.push(unsub);
        }
    });

    rebuild('init');

    return () => {
        disposed = true;
        clearTimeout(debounceTimer);
        disposers.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
    };
}
