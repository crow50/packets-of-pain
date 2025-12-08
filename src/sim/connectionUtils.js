const DEFAULT_LINK_COST = 10;
const DEFAULT_PORT_ROLE = 'designated';

const coerceBoolean = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);
const normalizedLinkCost = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_LINK_COST);
const normalizedPortRole = (value) => (typeof value === 'string' && value.trim().length > 0 ? value : DEFAULT_PORT_ROLE);
const normalizedLinkId = (value) => (typeof value === 'string' && value.length > 0 ? value : null);

export function createConnectionObject(targetId, overrides = {}) {
    if (!targetId) return null;
    return {
        targetId,
        bidirectional: coerceBoolean(overrides.bidirectional, true),
        linkCost: normalizedLinkCost(overrides.linkCost),
        portRole: normalizedPortRole(overrides.portRole),
        active: coerceBoolean(overrides.active, true),
        linkId: normalizedLinkId(overrides.linkId || overrides.id)
    };
}

export function upgradeConnectionFormat(node) {
    if (!node) return [];
    if (!Array.isArray(node.connections)) {
        node.connections = [];
        return node.connections;
    }
    node.connections = node.connections
        .map(conn => {
            if (typeof conn === 'string') {
                return createConnectionObject(conn, { bidirectional: true });
            }
            if (conn && typeof conn === 'object') {
                const targetId = conn.targetId || conn.id;
                if (!targetId) {
                    return null;
                }
                return createConnectionObject(targetId, conn);
            }
            return null;
        })
        .filter(Boolean);
    return node.connections;
}

export function listConnections(node, options = {}) {
    const includeInactive = options.includeInactive ?? false;
    return upgradeConnectionFormat(node).filter(conn => includeInactive || conn.active !== false);
}

export function getConnectionTargets(node, options = {}) {
    return listConnections(node, options).map(conn => conn.targetId);
}

export function hasConnection(node, targetId) {
    if (!targetId) return false;
    return upgradeConnectionFormat(node).some(conn => conn.targetId === targetId);
}

export function removeConnections(node, predicate) {
    if (!node || typeof predicate !== 'function') return;
    const normalized = upgradeConnectionFormat(node);
    node.connections = normalized.filter(conn => !predicate(conn));
}

export function findConnection(node, predicate) {
    if (!node || typeof predicate !== 'function') return null;
    return upgradeConnectionFormat(node).find(predicate) || null;
}

export {
    DEFAULT_LINK_COST
};

// Temporary global bridge for legacy callers (to be removed)
