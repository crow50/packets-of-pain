export function resolveState(arg1) {
    if (arg1 && (arg1.simulation || arg1.ui)) {
        return arg1;
    }
    if (typeof globalThis !== "undefined") {
        const runtimeState = globalThis.__POP_RUNTIME__?.current?.engine?._state;
        if (runtimeState) {
            return runtimeState;
        }
    }
    return typeof STATE !== "undefined" ? STATE : undefined;
}

export function syncLegacyState(sourceState) {
    if (typeof STATE === "undefined") {
        return undefined;
    }

    const resolved = resolveState(sourceState) || STATE;
    const sim = resolved.simulation || resolved;
    const ui = resolved.ui || resolved;

    STATE.simulation = sim;
    STATE.ui = ui;

    if (Array.isArray(sim?.services)) {
        STATE.services = sim.services;
    }
    if (Array.isArray(sim?.requests)) {
        STATE.requests = sim.requests;
    }
    if (Array.isArray(sim?.connections)) {
        STATE.connections = sim.connections;
    }
    if (sim?.internetNode) {
        STATE.internetNode = sim.internetNode;
    }
    if (sim?.score) {
        STATE.score = sim.score;
    }

    if (typeof sim?.money === "number") {
        STATE.money = sim.money;
    }
    if (typeof sim?.reputation === "number") {
        STATE.reputation = sim.reputation;
    }
    if (typeof sim?.requestsProcessed === "number") {
        STATE.requestsProcessed = sim.requestsProcessed;
    }
    if (typeof sim?.spawnTimer === "number") {
        STATE.spawnTimer = sim.spawnTimer;
    }
    if (typeof sim?.currentRPS === "number") {
        STATE.currentRPS = sim.currentRPS;
    }
    if (typeof sim?.time === "number") {
        STATE.time = sim.time;
    }
    if (sim?.trafficProfile) {
        STATE.trafficProfile = sim.trafficProfile;
    }

    if (typeof ui?.timeScale === "number") {
        STATE.timeScale = ui.timeScale;
    }
    if (typeof ui?.isRunning === "boolean") {
        STATE.isRunning = ui.isRunning;
    }
    if ("hovered" in (ui || {})) {
        STATE.hovered = ui.hovered;
    }
    if ("activeTool" in (ui || {})) {
        STATE.activeTool = ui.activeTool;
    }
    if ("selectedNodeId" in (ui || {})) {
        STATE.selectedNodeId = ui.selectedNodeId;
    }
    if (ui?.sound) {
        STATE.sound = ui.sound;
    }
    if (ui?.gameMode) {
        STATE.gameMode = ui.gameMode;
    }

    return STATE;
}
