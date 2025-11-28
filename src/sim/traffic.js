function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

function resolveState(arg) {
    if (arg && (arg.simulation || arg.ui)) return arg;
    const engine = getEngine();
    return engine ? engine.getState() : null;
}

function updateReputationBar(sim) {
    const bar = document.getElementById('rep-bar');
    if (!bar) return;
    const reputation = sim?.reputation ?? 100;
    const clamped = Math.max(0, Math.min(100, reputation));
    bar.style.width = `${clamped}%`;
    bar.classList.toggle('bg-red-500', clamped <= 30);
    bar.classList.toggle('bg-yellow-500', clamped > 30 && clamped <= 70);
    bar.classList.toggle('bg-green-500', clamped > 70);
}

function updateScoreUI(sim) {
    const score = sim?.score ?? { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };
    setText('total-score-display', score.total);
    setText('score-web', score.web);
    setText('score-api', score.api);
    setText('score-fraud', score.fraudBlocked);
    updateReputationBar(sim);
}

export function updateScore(arg1, arg2, arg3) {
    // Overload: updateScore(req, outcome) OR updateScore(state, req, outcome)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;
    const outcome = hasState ? arg3 : arg2;

    const sim = state.simulation || state;

    const points = CONFIG.survival.SCORE_POINTS;
    if (req && outcome) {
        switch (outcome) {
            case 'COMPLETED':
                if (req.type === TRAFFIC_TYPES.WEB) {
                    sim.score.web += points.WEB_SCORE;
                    sim.money += points.WEB_REWARD;
                } else if (req.type === TRAFFIC_TYPES.API) {
                    sim.score.api += points.API_SCORE;
                    sim.money += points.API_REWARD;
                }
                break;
            case 'FAILED':
                sim.reputation += points.FAIL_REPUTATION;
                break;
            case 'FRAUD_PASSED':
                sim.reputation += points.FRAUD_PASSED_REPUTATION;
                break;
            case 'FRAUD_BLOCKED':
                sim.score.fraudBlocked += points.FRAUD_BLOCKED_SCORE;
                break;
        }
        sim.reputation = Math.min(100, Math.max(0, sim.reputation));
        sim.score.total = sim.score.web + sim.score.api + sim.score.fraudBlocked;
    } else {
        sim.score.total = sim.score.web + sim.score.api + sim.score.fraudBlocked;
    }
    updateScoreUI(sim);
}

export function removeRequest(arg1, arg2) {
    // Overload: removeRequest(req) OR removeRequest(state, req)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    if (req && typeof req.destroy === 'function') {
        req.destroy();
    }
    sim.requests = sim.requests.filter(r => r !== req);
    updateScore(state);
}

export function finishRequest(arg1, arg2) {
    // Overload: finishRequest(req) OR finishRequest(state, req)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.requestsProcessed++;
    updateScore(state, req, 'COMPLETED');
    removeRequest(state, req);
}

export function failRequest(arg1, arg2) {
    // Overload: failRequest(req) OR failRequest(state, req)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;

    const ui = state.ui || state;

    const failType = req.type === TRAFFIC_TYPES.FRAUD ? 'FRAUD_PASSED' : 'FAILED';
    updateScore(state, req, failType);
    ui.sound?.playFail?.();
    if (req.mesh && req.mesh.material) {
        req.mesh.material.color.setHex(CONFIG.colors.requestFail);
    }
    setTimeout(() => removeRequest(state, req), 500);
}

function calculateFailChanceBasedOnLoad(load) {
    const clamped = Math.max(0, Math.min(1, load));
    if (clamped <= 0.8) return 0;
    return (clamped - 0.8) / 0.2;
}

window.calculateFailChanceBasedOnLoad = calculateFailChanceBasedOnLoad;

window.updateScore = updateScore;
window.removeRequest = removeRequest;
window.finishRequest = finishRequest;
window.failRequest = failRequest;

function getTrafficType() {
    const r = Math.random();
    const dist = CONFIG.survival.trafficDistribution;
    if (r < dist[TRAFFIC_TYPES.WEB]) return TRAFFIC_TYPES.WEB;
    if (r < dist[TRAFFIC_TYPES.WEB] + dist[TRAFFIC_TYPES.API]) return TRAFFIC_TYPES.API;
    return TRAFFIC_TYPES.FRAUD;
}

function spawnRequest(state) {
    const sim = state.simulation || state;
    const ui = state.ui || state;

    let type = getTrafficType();
    const trafficProfile = sim.trafficProfile || GameContext.trafficProfile;
    const gameMode = ui.gameMode || 'sandbox';
    
    if (gameMode === 'campaign' && trafficProfile) {
        const { userToInternetPps = 0, maliciousRate = 0 } = trafficProfile;
        const total = userToInternetPps + maliciousRate;
        if (total > 0) {
            const fraudChance = maliciousRate / total;
            type = Math.random() < fraudChance ? TRAFFIC_TYPES.FRAUD : TRAFFIC_TYPES.WEB;
        } else {
            type = TRAFFIC_TYPES.WEB;
        }
    }
    const req = new Request(type);
    sim.requests.push(req);
    const conns = sim.internetNode.connections;
    if (conns.length > 0) {
        const entryNodes = conns.map(id => sim.services.find(s => s.id === id));
        const wafEntry = entryNodes.find(s => s && s.type === 'waf');
        const target = wafEntry || entryNodes[Math.floor(Math.random() * entryNodes.length)];

        if (target) {
            req.lastNodeId = 'internet';
            req.flyTo(target);
        } else failRequest(state, req);
    } else failRequest(state, req);
}

export function initTrafficForMode(arg1, arg2) {
    // Overload: initTrafficForMode(mode) OR initTrafficForMode(state, mode)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const mode = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.spawnTimer = 0;
    sim.currentRPS = CONFIG.survival.baseRPS;
    if (mode === 'campaign') {
        sim.currentRPS = CONFIG.survival.baseRPS;
    }
}

export function gameTick(arg1, arg2) {
    // Overload: gameTick(delta) OR gameTick(state, delta)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const dt = hasState ? arg2 : arg1;

    const sim = state.simulation || state;
    const ui = state.ui || state;

    const timeScale = ui.timeScale ?? 1;
    const scaledDt = dt * timeScale;

    sim.spawnTimer += scaledDt;
    if (sim.currentRPS > 0 && sim.spawnTimer > 1 / sim.currentRPS) {
        spawnRequest(state);
        sim.spawnTimer = 0;
    }

    const gameMode = ui.gameMode || 'sandbox';
    if (gameMode === 'survival') {
        sim.currentRPS += CONFIG.survival.rampUp * scaledDt;
    }

    sim.services.forEach(s => s.update(scaledDt));
    sim.requests.forEach(r => r.update(scaledDt));
}
