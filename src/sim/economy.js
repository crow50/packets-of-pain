import { GAME_MODES } from "../modes/constants.js";
import { CONFIG } from "../config/gameConfig.js";
import { getRuntimeEngine } from "../utils/runtime.js";

let economyEngine = null;
export function attachEconomyEngine(engine) {
    economyEngine = engine;
}

function getEngine() {
    return economyEngine || getRuntimeEngine();
}

function resolveState(arg) {
    if (arg && (arg.simulation || arg.ui)) return arg;
    const engine = getEngine();
    return engine ? engine.getState() : null;
}

const DEFAULT_TRAFFIC_PROFILE = {
    userToInternetPps: CONFIG.survival.baseRPS || 0.5,
    maliciousRate: 0,
    inboundOnly: false,
    spawnRps: CONFIG.survival.baseRPS || 0.5,
    rpsRampPerSecond: 0
};

function ensureToolbarList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => typeof item === 'string' ? item.toLowerCase() : item);
}

export function resetEconomyForMode(arg1, arg2, arg3) {
    // Overload: resetEconomyForMode(mode, options) OR resetEconomyForMode(state, mode, options)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
        const defaultMode = GAME_MODES?.SANDBOX || 'sandbox';
        const mode = hasState ? (arg2 || defaultMode) : (arg1 || defaultMode);
    const options = hasState ? (arg3 || {}) : (arg2 || {});

    if (!state) return;
    const sim = state.simulation || state;
    const ui = state.ui || state;

    sim.activeMode = mode;
    sim.requestsProcessed = 0;
    sim.services = [];
    sim.requests = [];
    sim.connections = [];
    sim.internetNode.connections = [];
    sim.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    ui.isRunning = true;
    ui.hovered = null;
    sim.spawnTimer = 0;
    const baseRPS = typeof sim.baseRPS === 'number' ? sim.baseRPS : CONFIG.survival.baseRPS;
    sim.currentRPS = baseRPS;

    const startBudget = options.startBudget ?? sim.defaultStartBudget ?? CONFIG.survival.startBudget;
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
        if (state) {
            const sim = state.simulation || state;
            sim.trafficProfile = null;
            const baseRPS = typeof sim.baseRPS === 'number' ? sim.baseRPS : CONFIG.survival.baseRPS;
            sim.currentRPS = baseRPS;
            sim.rpsRampPerSecond = 0;
            sim.spawnTimer = 0;
        }
        return;
    }

    if (!state) return;
    const sim = state.simulation || state;

    const userRate = profile.userToInternetPps !== undefined ? profile.userToInternetPps : DEFAULT_TRAFFIC_PROFILE.userToInternetPps;
    const maliciousRate = profile.maliciousRate !== undefined ? profile.maliciousRate : DEFAULT_TRAFFIC_PROFILE.maliciousRate;
    const spawnRps = profile.spawnRps !== undefined ? profile.spawnRps : (userRate + maliciousRate);
    const normalized = {
        userToInternetPps: userRate,
        maliciousRate,
        inboundOnly: Boolean(profile.inboundOnly),
        spawnRps: Math.max(0, spawnRps !== undefined ? spawnRps : DEFAULT_TRAFFIC_PROFILE.spawnRps),
        rpsRampPerSecond: typeof profile.rpsRampPerSecond === 'number' ? profile.rpsRampPerSecond : DEFAULT_TRAFFIC_PROFILE.rpsRampPerSecond
    };

    sim.trafficProfile = normalized;
    sim.currentRPS = normalized.spawnRps;
    sim.rpsRampPerSecond = normalized.rpsRampPerSecond;
    sim.spawnTimer = 0;
}
