(function initConnectionUtils(global) {
    const DEFAULT_LINK_COST = 10;
    const DEFAULT_PORT_ROLE = 'designated';

    const coerceBoolean = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);

    const normalizedLinkCost = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_LINK_COST);

    const normalizedPortRole = (value) => (typeof value === 'string' && value.trim().length > 0 ? value : DEFAULT_PORT_ROLE);

    const normalizedLinkId = (value) => (typeof value === 'string' && value.length > 0 ? value : null);

    function createConnectionObject(targetId, overrides = {}) {
        if (!targetId) {
            return null;
        }
        return {
            targetId,
            bidirectional: coerceBoolean(overrides.bidirectional, true),
            linkCost: normalizedLinkCost(overrides.linkCost),
            portRole: normalizedPortRole(overrides.portRole),
            active: coerceBoolean(overrides.active, true),
            linkId: normalizedLinkId(overrides.linkId || overrides.id)
        };
    }

    function upgradeConnectionFormat(node) {
        if (!node) {
            return [];
        }
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

    function listConnections(node, options = {}) {
        const includeInactive = options.includeInactive ?? false;
        return upgradeConnectionFormat(node).filter(conn => includeInactive || conn.active !== false);
    }

    function getConnectionTargets(node, options = {}) {
        return listConnections(node, options).map(conn => conn.targetId);
    }

    function hasConnection(node, targetId) {
        if (!targetId) return false;
        return upgradeConnectionFormat(node).some(conn => conn.targetId === targetId);
    }

    function removeConnections(node, predicate) {
        if (!node || typeof predicate !== 'function') {
            return;
        }
        const normalized = upgradeConnectionFormat(node);
        node.connections = normalized.filter(conn => !predicate(conn));
    }

    function findConnection(node, predicate) {
        if (!node || typeof predicate !== 'function') {
            return null;
        }
        return upgradeConnectionFormat(node).find(predicate) || null;
    }

    const api = {
        DEFAULT_LINK_COST,
        createConnectionObject,
        upgradeConnectionFormat,
        listConnections,
        getConnectionTargets,
        hasConnection,
        removeConnections,
        findConnection
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (global) {
        global.ConnectionUtils = Object.assign({}, global.ConnectionUtils || {}, api);
    }
})(typeof window !== 'undefined' ? window : globalThis);
