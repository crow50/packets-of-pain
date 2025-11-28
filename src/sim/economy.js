function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

function resolveState(arg) {
    if (arg && (arg.simulation || arg.ui)) return arg;
    const engine = getEngine();
    return engine ? engine.getState() : null;
}

const DEFAULT_TRAFFIC_PROFILE = {
    userToInternetPps: CONFIG.survival.baseRPS || 0.5,
    maliciousRate: 0
};

const GameContext = {
    mode: "sandbox",
    currentLevelId: null,
    trafficProfile: null,
    toolbarWhitelist: []
};
window.GameContext = GameContext;

function ensureToolbarList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => typeof item === 'string' ? item.toLowerCase() : item);
}

export function resetEconomyForMode(arg1, arg2, arg3) {
    // Overload: resetEconomyForMode(mode, options) OR resetEconomyForMode(state, mode, options)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const mode = hasState ? (arg2 || 'survival') : (arg1 || 'survival');
    const options = hasState ? (arg3 || {}) : (arg2 || {});

    if (!state) return;
    const sim = state.simulation || state;
    const ui = state.ui || state;

    ui.gameMode = mode;
    sim.requestsProcessed = 0;
    sim.services = [];
    sim.requests = [];
    sim.connections = [];
    sim.internetNode.connections = [];
    sim.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    ui.isRunning = true;
    ui.hovered = null;
    sim.spawnTimer = 0;
    sim.currentRPS = CONFIG.survival.baseRPS;

    const startBudget = options.startBudget ?? CONFIG.survival.startBudget;
    resetScore(state);
    resetSatisfaction(state);
    setBudget(state, startBudget);

    const targetTimeScale = options.initialTimeScale ?? 0;
    setTimeScale(state, targetTimeScale);
}

export function setBudget(arg1, arg2) {
    // Overload: setBudget(value) OR setBudget(state, value)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const value = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.money = value;
}

export function resetSatisfaction(arg1) {
    // Overload: resetSatisfaction() OR resetSatisfaction(state)
    const state = resolveState(arg1);
    if (!state) return;
    const sim = state.simulation || state;

    sim.reputation = 100;
}

export function resetScore(arg1) {
    // Overload: resetScore() OR resetScore(state)
    const state = resolveState(arg1);
    if (!state) return;
    const sim = state.simulation || state;

    sim.score.total = 0;
    sim.score.web = 0;
    sim.score.api = 0;
    sim.score.fraudBlocked = 0;
}


export function setTimeScale(arg1, arg2) {
    // Overload: setTimeScale(s) OR setTimeScale(state, s)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const s = hasState ? arg2 : arg1;

    const ui = state.ui || state;

    ui.timeScale = s;
    window.dispatchEvent(new CustomEvent('pop-timeScaleChanged', { detail: { scale: s } }));
}


export function setTrafficProfile(arg1, arg2) {
    // Overload: setTrafficProfile(profile) OR setTrafficProfile(state, profile)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const profile = hasState ? arg2 : arg1;

    if (!profile) {
        GameContext.trafficProfile = null;
        if (state) {
            const sim = state.simulation || state;
            sim.trafficProfile = null;
            sim.currentRPS = CONFIG.survival.baseRPS;
            sim.spawnTimer = 0;
        }
        return;
    }

    if (!state) return;
    const sim = state.simulation || state;

    const normalized = {
        userToInternetPps: profile.userToInternetPps !== undefined ? profile.userToInternetPps : DEFAULT_TRAFFIC_PROFILE.userToInternetPps,
        maliciousRate: profile.maliciousRate !== undefined ? profile.maliciousRate : DEFAULT_TRAFFIC_PROFILE.maliciousRate
    };

    GameContext.trafficProfile = normalized;
    sim.trafficProfile = normalized;
    sim.currentRPS = normalized.userToInternetPps + normalized.maliciousRate;
    sim.spawnTimer = 0;
}

export { GameContext };

window.setTimeScale = setTimeScale;
