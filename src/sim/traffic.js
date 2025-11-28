import Request from "../entities/Request.js";
import { toPlainPosition } from "./vectorUtils.js";

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

function resolveState(arg) {
    if (arg && (arg.simulation || arg.ui)) return arg;
    const engine = getEngine();
    return engine ? engine.getState() : null;
}

function emitEvent(event, payload) {
    const engine = getEngine();
    engine?.emit?.(event, payload);
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
}

export function finishRequest(arg1, arg2) {
    // Overload: finishRequest(req) OR finishRequest(state, req)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.requestsProcessed++;
    updateScore(state, req, 'COMPLETED');
    emitEvent('requestFinished', { requestId: req.id });
    removeRequest(state, req);
}

export function failRequest(arg1, arg2, arg3) {
    // Overload: failRequest(req) OR failRequest(state, req) OR failRequest(req, reason) OR failRequest(state, req, reason)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;
    const reason = hasState ? arg3 : arg2;

    const ui = state.ui || state;
    const sim = state.simulation || state;

    const failType = req.type === TRAFFIC_TYPES.FRAUD ? 'FRAUD_PASSED' : 'FAILED';
    
    // Apply heavier penalty for misconfig failures
    if (reason === 'misconfig') {
        const points = CONFIG.survival.SCORE_POINTS;
        sim.reputation += (points.FAIL_REPUTATION || -2) * 2; // Double penalty
        sim.reputation = Math.min(100, Math.max(0, sim.reputation));
    } else {
        updateScore(state, req, failType);
    }
    
    ui.sound?.playFail?.();
    emitEvent('requestFailed', { requestId: req.id, reason: reason || 'unknown' });
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

function getTrafficType(sim) {
    const r = Math.random();
    // Use sim.trafficDistribution if set (sandbox), otherwise fall back to survival config
    const dist = sim?.trafficDistribution || CONFIG.survival.trafficDistribution;
    if (r < dist[TRAFFIC_TYPES.WEB]) return TRAFFIC_TYPES.WEB;
    if (r < dist[TRAFFIC_TYPES.WEB] + dist[TRAFFIC_TYPES.API]) return TRAFFIC_TYPES.API;
    return TRAFFIC_TYPES.FRAUD;
}

function spawnRequest(state) {
    const sim = state.simulation || state;
    const ui = state.ui || state;

    let type = getTrafficType(sim);
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
    emitEvent('requestSpawned', { requestId: req.id, type: req.type, from: toPlainPosition(req.position) });
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

// Spawn a burst of requests of a specific type (for sandbox testing)
export function spawnBurstOfType(state, type, count) {
    const sim = state.simulation || state;
    const conns = sim.internetNode.connections;
    
    for (let i = 0; i < count; i++) {
        const req = new Request(type);
        sim.requests.push(req);
        emitEvent('requestSpawned', { requestId: req.id, type: req.type, from: toPlainPosition(req.position) });
        
        if (conns.length > 0) {
            const entryNodes = conns.map(id => sim.services.find(s => s.id === id));
            const wafEntry = entryNodes.find(s => s && s.type === 'waf');
            const target = wafEntry || entryNodes[Math.floor(Math.random() * entryNodes.length)];

            if (target) {
                req.lastNodeId = 'internet';
                req.flyTo(target);
            } else {
                failRequest(state, req);
            }
        } else {
            failRequest(state, req);
        }
    }
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
