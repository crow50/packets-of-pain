function getUserNodes(sim) {
    if (!sim?.services?.length) return [];
    return sim.services.filter(service => service?.type === 'user');
}

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
