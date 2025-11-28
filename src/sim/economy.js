import { resolveState, syncLegacyState } from "../core/stateBridge.js";

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

function getMoneyDisplay() {
    return document.getElementById('money-display');
}

function getRepBar() {
    return document.getElementById('rep-bar');
}

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
    syncLegacyState(state);
}

export function setBudget(arg1, arg2) {
    // Overload: setBudget(value) OR setBudget(state, value)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const value = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.money = value;
    const display = getMoneyDisplay();
    if (display) {
        display.innerText = `$${sim.money.toFixed(2)}`;
    }
    syncLegacyState(state);
}

export function resetSatisfaction(arg1) {
    // Overload: resetSatisfaction() OR resetSatisfaction(state)
    const state = resolveState(arg1);
    const sim = state.simulation || state;

    sim.reputation = 100;
    const repBar = getRepBar();
    if (repBar) {
        repBar.style.width = '100%';
        repBar.classList.remove('bg-red-500');
        repBar.classList.add('bg-yellow-500');
    }
    syncLegacyState(state);
}

export function resetScore(arg1) {
    // Overload: resetScore() OR resetScore(state)
    const state = resolveState(arg1);
    const sim = state.simulation || state;

    sim.score.total = 0;
    sim.score.web = 0;
    sim.score.api = 0;
    sim.score.fraudBlocked = 0;
    syncLegacyState(state);
}


export function setTimeScale(arg1, arg2) {
    // Overload: setTimeScale(s) OR setTimeScale(state, s)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const s = hasState ? arg2 : arg1;

    const ui = state.ui || state;

    ui.timeScale = s;
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));

    const btnPause = document.getElementById('btn-pause');
    const btnPlay = document.getElementById('btn-play');
    const btnFast = document.getElementById('btn-fast');

    if (s === 0) {
        btnPause?.classList.add('active');
        btnPlay?.classList.add('pulse-green');
    } else if (s === 1) {
        btnPlay?.classList.add('active');
        btnPlay?.classList.remove('pulse-green');
    } else if (s === 3) {
        btnFast?.classList.add('active');
        btnPlay?.classList.remove('pulse-green');
    }
    syncLegacyState(state);
}
window.setTimeScale = setTimeScale;

export function applyToolbarWhitelist(list = []) {
    GameContext.toolbarWhitelist = list;
    const normalized = ensureToolbarList(list);
    document.querySelectorAll('[data-tool-name]').forEach(btn => {
        const name = btn.dataset.toolName ? btn.dataset.toolName.toLowerCase() : '';
        const id = btn.dataset.toolId ? btn.dataset.toolId.toLowerCase() : '';
        const allowed = normalized.length === 0 || normalized.includes(name) || normalized.includes(id);
        btn.disabled = !allowed;
        btn.classList.toggle('opacity-40', !allowed);
    });
}
window.applyToolbarWhitelist = applyToolbarWhitelist;

export function setTrafficProfile(arg1, arg2) {
    // Overload: setTrafficProfile(profile) OR setTrafficProfile(state, profile)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const profile = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    if (!profile) {
        GameContext.trafficProfile = null;
        sim.trafficProfile = null;
        sim.currentRPS = CONFIG.survival.baseRPS;
        sim.spawnTimer = 0;
        syncLegacyState(state);
        return;
    }

    const normalized = {
        userToInternetPps: profile.userToInternetPps !== undefined ? profile.userToInternetPps : DEFAULT_TRAFFIC_PROFILE.userToInternetPps,
        maliciousRate: profile.maliciousRate !== undefined ? profile.maliciousRate : DEFAULT_TRAFFIC_PROFILE.maliciousRate
    };

    GameContext.trafficProfile = normalized;
    sim.trafficProfile = normalized;
    sim.currentRPS = normalized.userToInternetPps + normalized.maliciousRate;
    sim.spawnTimer = 0;
    syncLegacyState(state);
}

export { GameContext };
