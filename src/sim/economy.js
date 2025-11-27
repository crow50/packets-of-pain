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

export function resetEconomyForMode(mode = 'survival', options = {}) {
    STATE.gameMode = mode;
    STATE.requestsProcessed = 0;
    STATE.services = [];
    STATE.requests = [];
    STATE.connections = [];
    STATE.internetNode.connections = [];
    STATE.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    STATE.isRunning = true;
    STATE.hovered = null;
    STATE.spawnTimer = 0;
    STATE.currentRPS = CONFIG.survival.baseRPS;
    STATE.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const startBudget = options.startBudget ?? CONFIG.survival.startBudget;
    resetScore();
    resetSatisfaction();
    setBudget(startBudget);

    const targetTimeScale = options.initialTimeScale ?? 0;
    setTimeScale(targetTimeScale);
}

export function setBudget(value) {
    STATE.money = value;
    const display = getMoneyDisplay();
    if (display) {
        display.innerText = `$${STATE.money.toFixed(2)}`;
    }
}

export function resetSatisfaction() {
    STATE.reputation = 100;
    const repBar = getRepBar();
    if (repBar) {
        repBar.style.width = '100%';
        repBar.classList.remove('bg-red-500');
        repBar.classList.add('bg-yellow-500');
    }
}

export function resetScore() {
    STATE.score.total = 0;
    STATE.score.web = 0;
    STATE.score.api = 0;
    STATE.score.fraudBlocked = 0;
}


export function setTimeScale(s) {
    STATE.timeScale = s;
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

export function setTrafficProfile(profile) {
    if (!profile) {
        GameContext.trafficProfile = null;
        STATE.currentRPS = CONFIG.survival.baseRPS;
        STATE.spawnTimer = 0;
        return;
    }

    const normalized = {
        userToInternetPps: profile.userToInternetPps !== undefined ? profile.userToInternetPps : DEFAULT_TRAFFIC_PROFILE.userToInternetPps,
        maliciousRate: profile.maliciousRate !== undefined ? profile.maliciousRate : DEFAULT_TRAFFIC_PROFILE.maliciousRate
    };

    GameContext.trafficProfile = normalized;
    STATE.currentRPS = normalized.userToInternetPps + normalized.maliciousRate;
    STATE.spawnTimer = 0;
}

export { GameContext };
