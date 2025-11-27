function updateReputationBar() {
    const bar = document.getElementById('rep-bar');
    if (!bar) return;
    const clamped = Math.max(0, Math.min(100, STATE.reputation));
    bar.style.width = `${clamped}%`;
    bar.classList.toggle('bg-red-500', clamped <= 30);
    bar.classList.toggle('bg-yellow-500', clamped > 30 && clamped <= 70);
    bar.classList.toggle('bg-green-500', clamped > 70);
}

function updateScoreUI() {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };
    setText('total-score-display', STATE.score.total);
    setText('score-web', STATE.score.web);
    setText('score-api', STATE.score.api);
    setText('score-fraud', STATE.score.fraudBlocked);
    updateReputationBar();
}

export function updateScore(req, outcome) {
    const points = CONFIG.survival.SCORE_POINTS;
    if (req && outcome) {
        switch (outcome) {
            case 'COMPLETED':
                if (req.type === TRAFFIC_TYPES.WEB) {
                    STATE.score.web += points.WEB_SCORE;
                    STATE.money += points.WEB_REWARD;
                } else if (req.type === TRAFFIC_TYPES.API) {
                    STATE.score.api += points.API_SCORE;
                    STATE.money += points.API_REWARD;
                }
                break;
            case 'FAILED':
                STATE.reputation += points.FAIL_REPUTATION;
                break;
            case 'FRAUD_PASSED':
                STATE.reputation += points.FRAUD_PASSED_REPUTATION;
                break;
            case 'FRAUD_BLOCKED':
                STATE.score.fraudBlocked += points.FRAUD_BLOCKED_SCORE;
                break;
        }
        STATE.reputation = Math.min(100, Math.max(0, STATE.reputation));
        STATE.score.total = STATE.score.web + STATE.score.api + STATE.score.fraudBlocked;
    } else {
        STATE.score.total = STATE.score.web + STATE.score.api + STATE.score.fraudBlocked;
    }
    updateScoreUI();
}

export function removeRequest(req) {
    if (req && typeof req.destroy === 'function') {
        req.destroy();
    }
    STATE.requests = STATE.requests.filter(r => r !== req);
    updateScore();
}

export function finishRequest(req) {
    STATE.requestsProcessed++;
    updateScore(req, 'COMPLETED');
    removeRequest(req);
}

export function failRequest(req) {
    const failType = req.type === TRAFFIC_TYPES.FRAUD ? 'FRAUD_PASSED' : 'FAILED';
    updateScore(req, failType);
    STATE.sound.playFail();
    if (req.mesh && req.mesh.material) {
        req.mesh.material.color.setHex(CONFIG.colors.requestFail);
    }
    setTimeout(() => removeRequest(req), 500);
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

function spawnRequest() {
    let type = getTrafficType();
    if (isCampaignMode() && GameContext.trafficProfile) {
        const { userToInternetPps = 0, maliciousRate = 0 } = GameContext.trafficProfile;
        const total = userToInternetPps + maliciousRate;
        if (total > 0) {
            const fraudChance = maliciousRate / total;
            type = Math.random() < fraudChance ? TRAFFIC_TYPES.FRAUD : TRAFFIC_TYPES.WEB;
        } else {
            type = TRAFFIC_TYPES.WEB;
        }
    }
    const req = new Request(type);
    STATE.requests.push(req);
    const conns = STATE.internetNode.connections;
    if (conns.length > 0) {
        const entryNodes = conns.map(id => STATE.services.find(s => s.id === id));
        const wafEntry = entryNodes.find(s => s && s.type === 'waf');
        const target = wafEntry || entryNodes[Math.floor(Math.random() * entryNodes.length)];

        if (target) {
            req.lastNodeId = 'internet';
            req.flyTo(target);
        } else failRequest(req);
    } else failRequest(req);
}

export function initTrafficForMode(mode) {
    STATE.spawnTimer = 0;
    STATE.currentRPS = CONFIG.survival.baseRPS;
    if (mode === 'campaign') {
        STATE.currentRPS = CONFIG.survival.baseRPS;
    }
}

export function gameTick(delta) {
    STATE.spawnTimer += delta * STATE.timeScale;
    if (STATE.currentRPS > 0 && STATE.spawnTimer > 1 / STATE.currentRPS) {
        spawnRequest();
        STATE.spawnTimer = 0;
    }

    if (STATE.gameMode === 'survival') {
        STATE.currentRPS += CONFIG.survival.rampUp * delta * STATE.timeScale;
    }

    STATE.services.forEach(s => s.update(delta * STATE.timeScale));
    STATE.requests.forEach(r => r.update(delta * STATE.timeScale));
}
