/**
 * trafficBehaviors.js - Mode-specific traffic source selection hooks
 * 
 * This module provides ONLY mode-specific source selection behavior.
 * It determines WHERE packets originate from based on the current game mode.
 * 
 * RESPONSIBILITIES:
 * - Selecting traffic source nodes (internet vs user nodes)
 * - Mode-specific spawn rate weighting (userToInternetPps vs maliciousRate)
 * - Providing hooks for mode behaviors to customize traffic sources
 * 
 * NOT RESPONSIBLE FOR (see traffic.js instead):
 * - Packet creation or lifecycle management
 * - Traffic class selection (WEB, API, FRAUD, MALICIOUS)
 * - Routing decisions or packet forwarding
 * - Score/reputation updates
 * 
 * @module trafficBehaviors
 * 
 * @test Campaign mode should use userToInternetPps for user→internet traffic ratio
 * @test Sandbox mode should use default internet source when no profile set
 * @test User nodes should be selected randomly when multiple exist
 * @test Should fall back to internet node when no user nodes available
 */

/**
 * Get all user service nodes from simulation
 * 
 * @param {Object} sim - Simulation state
 * @returns {Object[]} Array of user service nodes
 * 
 * @test Should return empty array when sim is null
 * @test Should return empty array when no services exist
 * @test Should filter only services with kind/type 'user'
 */
function getUserNodes(sim) {
    if (!sim?.services?.length) return [];
    return sim.services.filter(service => service?.kind === 'USER');
}

/**
 * Campaign mode traffic source selection behavior
 * 
 * Determines whether a packet should originate from a user node or the internet
 * based on the traffic profile's userToInternetPps and maliciousRate settings.
 * 
 * @param {Object} options - Behavior options
 * @param {Object} options.sim - Simulation state
 * @param {Object} options.trafficProfile - Traffic profile with rate settings
 * @param {Object} options.defaultResult - Fallback result if behavior doesn't apply
 * @param {Function} [options.rng=Math.random] - Random number generator for testing
 * @returns {Object} { source: node, fromUser: boolean }
 * 
 * @test Should return defaultResult when sim is null
 * @test Should return defaultResult when no user nodes exist
 * @test Should return defaultResult when total rate is zero
 * @test Should select user source proportional to userToInternetPps / (userToInternetPps + maliciousRate)
 * @test Should select internet source proportional to maliciousRate / (userToInternetPps + maliciousRate)
 * @test Should randomly select among multiple user nodes with equal probability
 */
export function campaignTrafficSourceBehavior({ sim, trafficProfile, defaultResult, rng = Math.random } = {}) {
    if (!sim) return defaultResult;
    const fallback = defaultResult || { source: sim.internetNode, fromUser: false };
    const userNodes = getUserNodes(sim);
    if (!userNodes.length) {
        return fallback;
    }

    const userRate = Math.max(0, trafficProfile?.userToInternetPps ?? 0);
    const internetRate = Math.max(0, trafficProfile?.maliciousRate ?? 0);
    const total = userRate + internetRate;
    if (total <= 0) {
        return fallback;
    }

    const threshold = userRate / total;
    const roll = typeof rng === 'function' ? rng() : Math.random();
    if (roll >= threshold) {
        return fallback;
    }

    const selectionRoll = typeof rng === 'function' ? rng() : Math.random();
    const selectedIndex = Math.floor(selectionRoll * userNodes.length);
    const selected = userNodes[selectedIndex] || fallback.source;
    return {
        source: selected,
        fromUser: Boolean(selected && selected !== sim.internetNode)
    };
}
