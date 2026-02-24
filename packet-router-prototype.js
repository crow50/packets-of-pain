/**
 * packet-router-prototype.js
 * 
 * A robust, pathfinding-based router for "Packets of Pain".
 * Replaces greedy/random routing with BFS-based intent routing.
 * 
 * Integration Guide:
 * 1. Import this class in `game.js`.
 * 2. Instantiate `const router = new PacketRouter(gridWidth, gridHeight, getAllGameNodes());`
 *    - Ensure `getAllGameNodes()` returns a Map or Object where keys are coordinate strings "x,y" 
 *      and values are node objects with { type, x, y }.
 * 3. Ensure your Packet objects have:
 *    - `type`: String (e.g., 'SQL_INJECTION')
 *    - `visitedTypes`: Array of strings (types of nodes visited so far)
 * 4. In your game loop or packet update tick:
 *    const nextNode = router.findNextHop(packet, currentPacketNode);
 *    if (nextNode) {
 *        packet.moveTo(nextNode);
 *        // IMPORTANT: Update history so the router knows requirements are met!
 *        if (!packet.visitedTypes.includes(nextNode.type)) {
 *             packet.visitedTypes.push(nextNode.type);
 *        }
 *    } else {
 *        packet.handleStuck();
 *    }
 */

// ==========================================
// 1. CONFIGURATION & DEFINITIONS
// ==========================================

/**
 * Defines packet types, their required stops, and ultimate destinations.
 */
const PACKET_DEFINITIONS = {
    'HTTP_REQUEST': {
        priority: 1,
        requirements: ['FIREWALL', 'LOAD_BALANCER'],
        destination: 'WEB_SERVER'
    },
    'SQL_QUERY': {
        priority: 2,
        requirements: ['FIREWALL', 'APP_SERVER'], // Must go through App Server first
        destination: 'DATABASE'
    },
    'SQL_INJECTION': {
        priority: 5,
        // In a defense game, maybe we WANT to route this to a Honey Pot or WAF?
        // Assuming this router facilitates the "good" path:
        requirements: ['WAF'], 
        destination: 'DATABASE' 
    },
    'SSH_ACCESS': {
        priority: 3,
        requirements: ['FIREWALL', 'BASTION_HOST'],
        destination: 'ADMIN_CONSOLE'
    },
    'HEARTBEAT': {
        priority: 0,
        requirements: [],
        destination: 'ANY' // Special case
    }
};

/**
 * Defines which node types can physically/logically connect to each other.
 * This prevents packets from jumping effectively "backwards" or skipping layers
 * if the grid placement is chaotic.
 * 
 * '*' allows connection to any adjacent node (useful for generic cables/routers).
 */
const TOPOLOGY_RULES = {
    'INTERNET': ['FIREWALL', 'ROUTER'],
    'ROUTER': ['*'], // Routers can connect to anything
    'FIREWALL': ['LOAD_BALANCER', 'WAF', 'BASTION_HOST', 'ROUTER'],
    'LOAD_BALANCER': ['WEB_SERVER', 'APP_SERVER', 'ROUTER'],
    'WAF': ['WEB_SERVER', 'APP_SERVER', 'LOAD_BALANCER', 'ROUTER'],
    'BASTION_HOST': ['ADMIN_CONSOLE', 'ROUTER'],
    'WEB_SERVER': ['APP_SERVER', 'DATABASE', 'ROUTER'], // Web connects to App or DB
    'APP_SERVER': ['DATABASE', 'ROUTER'],
    'DATABASE': ['ROUTER'], // DB is usually a terminal node, but can route back to Router
    'ADMIN_CONSOLE': ['ROUTER']
};

// ==========================================
// 2. ROUTER LOGIC
// ==========================================

class PacketRouter {
    /**
     * @param {number} width - Grid width
     * @param {number} height - Grid height
     * @param {Map<string, Object>} nodeMap - Map of "x,y" -> Node Object. 
     *                                        Node must have { type, x, y, active: boolean }.
     */
    constructor(width, height, nodeMap) {
        this.width = width;
        this.height = height;
        this.nodes = nodeMap; // Expected format: Key "x,y", Value { type: 'FIREWALL', x: 2, y: 3, ... }
    }

    /**
     * Determines the next immediate step for a packet.
     * Uses BFS to find the shortest path to the next required node type or destination.
     * 
     * @param {Object} packet - { type, visitedNodes: [], ... }
     * @param {Object} currentNode - The node the packet is currently at { x, y, type }
     * @returns {Object|null} The next node to move to, or null if no path exists.
     */
    findNextHop(packet, currentNode) {
        const def = PACKET_DEFINITIONS[packet.type];
        if (!def) {
            console.warn(`Unknown packet type: ${packet.type}`);
            return null;
        }

        // 1. Determine Target Type
        let targetType = null;

        // Check requirements first (in order)
        for (const req of def.requirements) {
            // If we haven't visited a required node type yet, that's our immediate target
            // We check packet.visitedNodes (array of node IDs or types)
            // Assuming visitedNodes stores types or we check current node history
            const hasVisited = packet.visitedTypes && packet.visitedTypes.includes(req);
            
            if (!hasVisited) {
                targetType = req;
                break;
            }
        }

        // If all requirements met, go to destination
        if (!targetType) {
            targetType = def.destination;
        }

        // If currently AT the target, we are done (or need to find the NEXT target?)
        if (currentNode.type === targetType) {
            // Re-evaluate to find the *next* thing needed after this one
            // (The calling game loop should probably handle "Arrival" logic before calling route,
            // but we handle the case where we are sitting on a fulfilled requirement)
             
            // Simple fix: If we are at the target, return null (stay/process) 
            // OR recursively search for the next target in the list.
            // For this prototype, we assume the game handles "processing" at the node.
            // If we are just passing through, we check if there's a subsequent target.
            return null; // Let the game logic handle "Process Packet" event
        }

        // 2. Find Path to Nearest 'targetType'
        const nextStep = this.bfs(currentNode, targetType);
        
        if (!nextStep) {
            // console.debug(`Packet stuck: ${packet.id} at ${currentNode.x},${currentNode.y} needs ${targetType}`);
            return null; // Dead end or no target of that type exists on board
        }

        return nextStep;
    }

    /**
     * Breadth-First Search to find the first step towards the nearest node of targetType.
     * @param {Object} startNode 
     * @param {string} targetType 
     * @returns {Object|null} The immediate neighbor node to move to.
     */
    bfs(startNode, targetType) {
        const queue = [];
        const visited = new Set();
        const cameFrom = new Map(); // For path reconstruction: visitedNodeKey -> sourceNode

        const startKey = `${startNode.x},${startNode.y}`;
        queue.push(startNode);
        visited.add(startKey);
        cameFrom.set(startKey, null);

        let foundTarget = null;

        while (queue.length > 0) {
            const current = queue.shift();

            // Check if this node matches target
            if (current.type === targetType) {
                foundTarget = current;
                break;
            }

            // Get valid neighbors
            const neighbors = this.getValidNeighbors(current);
            for (const neighbor of neighbors) {
                const nKey = `${neighbor.x},${neighbor.y}`;
                if (!visited.has(nKey)) {
                    visited.add(nKey);
                    cameFrom.set(nKey, current);
                    queue.push(neighbor);
                }
            }
        }

        if (!foundTarget) return null;

        // Reconstruct path to find the *first* step
        let curr = foundTarget;
        let currKey = `${curr.x},${curr.y}`;
        
        // Backtrack until we find the node that came from startNode
        while (cameFrom.get(currKey) !== startNode) {
            curr = cameFrom.get(currKey);
            if (!curr) return null; // Should not happen if logic is sound
            currKey = `${curr.x},${curr.y}`;
        }

        return curr; // This is the immediate neighbor
    }

    /**
     * Returns physically adjacent nodes that are valid connections according to TOPOLOGY_RULES.
     * @param {Object} node 
     */
    getValidNeighbors(node) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }, // Left
            { dx: 1, dy: 0 }   // Right
        ];

        // Valid connection types for the current node
        const allowedConnections = TOPOLOGY_RULES[node.type] || ['*'];
        const canConnectToAnything = allowedConnections.includes('*');

        for (const dir of directions) {
            const nx = node.x + dir.dx;
            const ny = node.y + dir.dy;
            const key = `${nx},${ny}`;

            // Check bounds (optional if map lookup handles it, but good for safety)
            if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

            const neighbor = this.nodes.get(key);
            if (neighbor && neighbor.active !== false) { // Ignore inactive/destroyed nodes
                // Check Topology Rules
                if (canConnectToAnything || allowedConnections.includes(neighbor.type)) {
                    neighbors.push(neighbor);
                }
            }
        }
        return neighbors;
    }
    
    /**
     * Validation utility to check if a valid path exists BEFORE launching a packet.
     * Can be used by the Spawner to prevent frustration.
     */
    canReachDestination(startNode, packetType) {
        // Simple check: Is there a path to the final destination?
        // Note: strictly this should check the chain (A -> B -> C), but 
        // checking the final destination is a good cheap heuristic.
        const def = PACKET_DEFINITIONS[packetType];
        if (!def) return false;
        
        // If it has requirements, check the first requirement
        const firstTarget = def.requirements.length > 0 ? def.requirements[0] : def.destination;
        return this.bfs(startNode, firstTarget) !== null;
    }
}

// Export for Node.js/CommonJS or ES6 depending on environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PacketRouter, PACKET_DEFINITIONS, TOPOLOGY_RULES };
} else {
    // Browser global
    window.PacketRouter = PacketRouter;
}
