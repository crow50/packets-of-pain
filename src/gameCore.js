import { LEVELS } from "./levels.js";
import {
    initScene,
    resetCamera,
    toggleCameraMode,
    scene,
    camera,
    renderer,
    serviceGroup,
    connectionGroup,
    requestGroup,
    internetMesh
} from "./render/scene.js";
import {
    initInteractions,
    getIntersect,
    snapToGrid,
    updateLinkVisuals,
    updateTooltip,
    raycaster,
    mouse,
    plane
} from "./render/interactions.js";

const GameContext = {
    mode: "sandbox",
    currentLevelId: null,
    trafficProfile: null
};
window.GameContext = GameContext;

const GAME_MODES = {
    SANDBOX: "sandbox",
    CAMPAIGN: "campaign",
};

let currentView = 'main-menu';

const BABY_LEVEL_IDS = ["baby-1", "baby-2", "baby-3"];
const BABYS_FIRST_NETWORK_LEVELS = BABY_LEVEL_IDS.map(id => LEVELS[id]).filter(Boolean);

const LEVEL_UNLOCK_CHAIN = {
    "baby-2": "baby-1",
    "baby-3": "baby-2",
};

const CAMPAIGN_HIGHLIGHT_MAP = {
    "baby-1": ["time-control-panel", "statsPanel", "shop-panel", "tool-connect", "tool-modem"]
};
const CAMPAIGN_HIGHLIGHT_IDS = (() => {
    const ref = [];
    Object.values(CAMPAIGN_HIGHLIGHT_MAP).forEach(list => ref.push(...list));
    return [...new Set(ref)];
})();

function updateCampaignHighlights(levelId) {
    const active = new Set(CAMPAIGN_HIGHLIGHT_MAP[levelId] || []);
    CAMPAIGN_HIGHLIGHT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('campaign-highlight', active.has(id));
    });
}

function updateGameModeLabel(isCampaign) {
    const label = document.getElementById('game-mode-label');
    if (!label) return;
    label.innerText = isCampaign ? 'CAMPAIGN' : 'SURVIVAL';
    label.classList.toggle('text-blue-400', isCampaign);
    label.classList.toggle('text-red-500', !isCampaign);
}

function setCampaignUIActive(active) {
    document.body.classList.toggle('campaign-mode', active);
    const objectivesPanel = document.getElementById('objectivesPanel');
    if (objectivesPanel) {
        objectivesPanel.classList.toggle('hidden', active);
    }
    updateGameModeLabel(active);
    if (!active) {
        showLevelInstructionsPanel(false);
        updateCampaignHighlights(null);
    }
}

const DEFAULT_TRAFFIC_PROFILE = {
    userToInternetPps: CONFIG.survival.baseRPS || 0.5,
    maliciousRate: 0
};

let container;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;
const panSpeed = 0.1;
let isDraggingNode = false;
let draggedNode = null;

export function initGame() {
    STATE.sound = new SoundService();

    container = document.getElementById('canvas-container');
    initScene(container);
    initInteractions();

    isPanning = false;
    lastMouseX = 0;
    lastMouseY = 0;
    isDraggingNode = false;
    draggedNode = null;

    resetCamera();

    setTimeout(() => {
        showMainMenu();
    }, 100);
}

function resetGame(mode = 'survival') {
    STATE.sound.init();
    STATE.sound.playGameBGM();
    STATE.gameMode = mode;
    STATE.money = CONFIG.survival.startBudget;
    STATE.reputation = 100;
    STATE.requestsProcessed = 0;
    STATE.services = [];
    STATE.requests = [];
    STATE.connections = [];
    STATE.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    STATE.isRunning = true;
    STATE.lastTime = performance.now();
    STATE.timeScale = 0;
    STATE.currentRPS = CONFIG.survival.baseRPS;
    STATE.spawnTimer = 0;
    STATE.hovered = null;

    resetCamera();

    // Clear visual elements
    while (serviceGroup.children.length > 0) {
        serviceGroup.remove(serviceGroup.children[0]);
    }
    while (connectionGroup.children.length > 0) {
        connectionGroup.remove(connectionGroup.children[0]);
    }
    while (requestGroup.children.length > 0) {
        requestGroup.remove(requestGroup.children[0]);
    }
    STATE.internetNode.connections = [];

    // Reset UI
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-pause').classList.add('active');
    document.getElementById('btn-play').classList.add('pulse-green');

    // Update UI displays
    updateScore();

    // Reset Reputation Bar
    const repBar = document.getElementById('rep-bar');
    if (repBar) {
        repBar.style.width = '100%';
        repBar.classList.remove('bg-red-500');
        repBar.classList.add('bg-yellow-500');
    }

}

function restartGame() {
    document.getElementById('modal').classList.add('hidden');
    resetGame();
}
window.restartGame = restartGame;



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


function removeRequest(req) {
    if (req && typeof req.destroy === 'function') {
        req.destroy();
    }
    STATE.requests = STATE.requests.filter(r => r !== req);
}

function finishRequest(req) {
    STATE.requestsProcessed++;
    updateScore(req, 'COMPLETED');
    removeRequest(req);
}

function failRequest(req) {
    const failType = req.type === TRAFFIC_TYPES.FRAUD ? 'FRAUD_PASSED' : 'FAILED';
    updateScore(req, failType);
    STATE.sound.playFail();
    if (req.mesh && req.mesh.material) {
        req.mesh.material.color.setHex(CONFIG.colors.requestFail);
    }
    setTimeout(() => removeRequest(req), 500);
}

function updateScoreUI() {
    const updateElement = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };
    updateElement('total-score-display', STATE.score.total);
    updateElement('score-web', STATE.score.web);
    updateElement('score-api', STATE.score.api);
    updateElement('score-fraud', STATE.score.fraudBlocked);
    updateReputationBar();
}

function updateReputationBar() {
    const bar = document.getElementById('rep-bar');
    if (!bar) return;
    const clamped = Math.max(0, Math.min(100, STATE.reputation));
    bar.style.width = `${clamped}%`;
    bar.classList.toggle('bg-red-500', clamped <= 30);
    bar.classList.toggle('bg-yellow-500', clamped > 30 && clamped <= 70);
    bar.classList.toggle('bg-green-500', clamped > 70);
}

function updateScore(req, outcome) {
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

window.removeRequest = removeRequest;
window.finishRequest = finishRequest;
window.failRequest = failRequest;
window.updateScore = updateScore;

function flashMoney() {
    const el = document.getElementById('money-display');
    el.classList.add('text-red-500');
    setTimeout(() => el.classList.remove('text-red-500'), 300);
}

function showView(viewName) {
    const sandboxEl = document.getElementById('sandbox-ui');
    const campaignEl = document.getElementById('campaign-hub');
    const menuEl = document.getElementById('main-menu-modal');
    if (!sandboxEl || !campaignEl || !menuEl) return;

    const setOverlayState = (el, isActive) => {
        el.classList.toggle('hidden', !isActive);
        el.style.pointerEvents = isActive ? 'auto' : 'none';
    };

    setOverlayState(sandboxEl, viewName === 'sandbox');
    setOverlayState(campaignEl, viewName === 'campaign');
    setOverlayState(menuEl, viewName === 'main-menu');

    if (viewName !== 'campaign') {
        hideCampaignLevels();
    }

    currentView = viewName;
}
window.showView = showView;


function showMainMenu() {
    // Ensure sound is initialized if possible (browsers might block until interaction)
    if (!STATE.sound.ctx) STATE.sound.init();
    STATE.sound.playMenuBGM();
    setCampaignUIActive(false);
    setSandboxObjectivesPanel();
    setSandboxShop();

    document.getElementById('main-menu-modal').classList.remove('hidden');
    document.getElementById('faq-modal').classList.add('hidden');
    document.getElementById('modal').classList.add('hidden');
    showView('main-menu');
    window.setTool('select');
}

let faqSource = 'menu'; // 'menu' or 'game'

window.showFAQ = (source = 'menu') => {
    faqSource = source;
    // If called from button (onclick="showFAQ()"), it defaults to 'menu' effectively unless we change the HTML.
    // But wait, the button in index.html just calls showFAQ(). 
    // We can check if main menu is visible.

    if (!document.getElementById('main-menu-modal').classList.contains('hidden')) {
        faqSource = 'menu';
        document.getElementById('main-menu-modal').classList.add('hidden');
    } else {
        faqSource = 'game';
    }

    document.getElementById('faq-modal').classList.remove('hidden');
};

window.closeFAQ = () => {
    document.getElementById('faq-modal').classList.add('hidden');
    if (faqSource === 'menu') {
        document.getElementById('main-menu-modal').classList.remove('hidden');
    }
};

window.startGame = (mode = GAME_MODES.SANDBOX) => {
    document.getElementById('main-menu-modal').classList.add('hidden');
    resetGame(mode === GAME_MODES.CAMPAIGN ? 'campaign' : 'survival');
};

window.startSandbox = () => {
    GameContext.mode = GAME_MODES.SANDBOX;
    setCampaignUIActive(false);
    setSandboxObjectivesPanel();
    setSandboxShop();
    GameContext.currentLevelId = null;
    setTrafficProfile(null);
    showLevelInstructionsPanel(false);
    showView('sandbox');
    window.setTool('select');  
    startGame(GAME_MODES.SANDBOX);
};

function isCampaignMode() {
    return GameContext.mode === GAME_MODES.CAMPAIGN;
}
window.isCampaignMode = isCampaignMode;

function getCurrentLevelId() {
    return GameContext.currentLevelId;
}
window.getCurrentLevelId = getCurrentLevelId;

window.startCampaign = () => {
    GameContext.mode = GAME_MODES.CAMPAIGN;
    setCampaignUIActive(true);
    setCampaignShop();
    showView('campaign');
    setCampaignIntroObjectives();
};

function startCampaignLevel(levelId) {
    const level = LEVELS[levelId];
    if (!level) {
        console.error('Unknown levelId', levelId);
        return;
    }
    GameContext.mode = GAME_MODES.CAMPAIGN;
    GameContext.currentLevelId = levelId;
    setCampaignUIActive(true);
    showLevelInstructionsPanel(true);
    showView('sandbox');
    startGame(GAME_MODES.CAMPAIGN);
    loadLevelConfig(levelId);
    markLevelComplete(levelId);
    renderCampaignLevels();
}
window.startCampaignLevel = startCampaignLevel;

function showLevelInstructionsPanel(visible) {
    const panel = document.getElementById('level-instructions-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
}

function resetSimulationState() {
    STATE.spawnTimer = 0;
    STATE.currentRPS = CONFIG.survival.baseRPS;
    STATE.requestsProcessed = 0;
    STATE.timeScale = 1;
    STATE.isRunning = true;
    STATE.internetNode.connections = [];
    STATE.money = 0;
    STATE.reputation = 100;
    STATE.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    updateScore();
    const repBar = document.getElementById('rep-bar');
    if (repBar) {
        repBar.style.width = '100%';
        repBar.classList.remove('bg-red-500');
        repBar.classList.add('bg-yellow-500');
    }
    clearAllNodesAndLinks();
}

function clearAllNodesAndLinks() {
    STATE.services.forEach(s => {
        if (s && typeof s.destroy === 'function') s.destroy();
    });
    STATE.requests.forEach(r => {
        if (r && typeof r.destroy === 'function') r.destroy();
    });
    STATE.connections.forEach(link => {
        if (link.mesh) {
            connectionGroup.remove(link.mesh);
            if (link.mesh.geometry) link.mesh.geometry.dispose();
            if (link.mesh.material) link.mesh.material.dispose();
        }
    });

    while (serviceGroup.children.length) {
        serviceGroup.remove(serviceGroup.children[0]);
    }
    while (connectionGroup.children.length) {
        const child = connectionGroup.children[0];
        connectionGroup.remove(child);
    }
    while (requestGroup.children.length) {
        requestGroup.remove(requestGroup.children[0]);
    }

    STATE.services = [];
    STATE.requests = [];
    STATE.connections = [];
    STATE.internetNode.connections = [];
}

function spawnNodeFromConfig(nodeConfig) {
    console.info('Spawning campaign node', nodeConfig);
}

function applyToolbarWhitelist(list = []) {
    GameContext.toolbarWhitelist = list;
    const normalized = list.map(item => typeof item === 'string' ? item.toLowerCase() : item);
    document.querySelectorAll('[data-tool-name]').forEach(btn => {
        const name = btn.dataset.toolName ? btn.dataset.toolName.toLowerCase() : '';
        const id = btn.dataset.toolId ? btn.dataset.toolId.toLowerCase() : '';
        const allowed = list.length === 0 || normalized.includes(name) || normalized.includes(id);
        btn.disabled = !allowed;
        btn.classList.toggle('opacity-40', !allowed);
    });
}

function setBudget(value) {
    STATE.money = value;
    const display = document.getElementById('money-display');
    if (display) {
        display.innerText = `$${STATE.money.toFixed(2)}`;
    }
}

function resetSatisfaction() {
    STATE.reputation = 100;
    const repBar = document.getElementById('rep-bar');
    if (repBar) {
        repBar.style.width = '100%';
        repBar.classList.remove('bg-red-500');
        repBar.classList.add('bg-yellow-500');
    }
}

function resetScore() {
    STATE.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    updateScore();
}

function setTrafficProfile(profile) {
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

function setLevelHeader(title, subtitle) {
    const titleEl = document.getElementById('level-instructions-title');
    const subEl = document.getElementById('level-instructions-subtitle');
    if (titleEl) titleEl.innerText = title || 'Campaign Objectives';
    if (subEl) subEl.innerText = subtitle || '';
}

function setLevelDescription(text) {
    const desc = document.getElementById('level-description');
    if (desc) desc.innerText = text || '';
}

function setLevelInstructions(instructions = []) {
    const list = document.getElementById('level-instructions');
    if (!list) return;
    list.innerHTML = '';
    instructions.forEach((instr) => {
        const li = document.createElement('li');
        li.textContent = instr;
        list.appendChild(li);
    });
}

function setCurrentLevelContext(levelId) {
    GameContext.currentLevelId = levelId;
}

const SHOP_DEFAULT_ORDER = ['modem', 'firewall', 'switch', 'waf', 'loadBalancer', 'compute', 'database', 'objectStorage'];
const CAMPAIGN_HUB_SHOP_ORDER = ['modem', 'firewall', 'waf'];
const CAMPAIGN_LEVEL_FALLBACK_SHOP = ['modem', 'waf'];
const SERVICE_SUBTITLES = {
    modem: 'Edge',
    firewall: 'Perimeter',
    switch: 'Aggregator',
    waf: 'Security',
    loadBalancer: 'Routing',
    compute: 'CPU',
    database: 'Persistence',
    objectStorage: 'Files'
};
const SERVICE_ICON = {
    modem: '⌂',
    firewall: '⛨',
    switch: '⇄',
    waf: '🛡️',
    loadBalancer: '⚙',
    compute: '☐',
    database: '◯',
    objectStorage: '⬡'
};

function buildShopButton(type) {
    const service = CONFIG.services[type];
    if (!service) return null;
    const button = document.createElement('button');
    button.id = `tool-${type}`;
    button.dataset.toolId = type;
    button.dataset.toolName = service.name;
    button.className = 'service-btn bg-gray-800 text-gray-200 p-2 rounded-lg w-16 h-20 flex flex-col items-center justify-center border border-transparent relative transition hover:border-white/40';
    button.onclick = () => setTool(type);
    const icon = SERVICE_ICON[type] || type.charAt(0).toUpperCase();
    button.innerHTML = `
        <div class="absolute top-0 right-0 bg-green-900/80 text-green-400 text-[9px] px-1 rounded-bl font-mono">$${service.cost}</div>
        <div class="text-2xl leading-none">${icon}</div>
        <span class="text-[10px] font-bold mt-1 leading-tight">${service.name}</span>
        <span class="text-[8px] text-gray-400 leading-tight">${SERVICE_SUBTITLES[type] || 'Service'}</span>
    `;
    return button;
}

function renderShopItems(serviceTypes = []) {
    const container = document.getElementById('shop-items');
    if (!container) return;
    container.innerHTML = '';
    serviceTypes.forEach(type => {
        const btn = buildShopButton(type);
        if (btn) container.appendChild(btn);
    });
}

function setShopForServiceList(serviceList) {
    const uniqueList = Array.from(new Set(serviceList));
    renderShopItems(uniqueList);
    applyToolbarWhitelist(GameContext.toolbarWhitelist || []);
}

function mapWhitelistToServices(list = []) {
    const normalized = new Set(list.map(item => typeof item === 'string' ? item.toLowerCase() : item));
    const services = [];
    SHOP_DEFAULT_ORDER.forEach(type => {
        if (normalized.has(type.toLowerCase())) services.push(type);
    });
    return services;
}

function setSandboxShop() {
    GameContext.toolbarWhitelist = [];
    setShopForServiceList(SHOP_DEFAULT_ORDER);
}

function setCampaignShop() {
    setShopForServiceList(CAMPAIGN_HUB_SHOP_ORDER);
}

function setShopForLevel(levelId) {
    const level = LEVELS[levelId];
    const derived = level ? mapWhitelistToServices(level.toolbarWhitelist) : [];
    setShopForServiceList(derived.length ? derived : CAMPAIGN_LEVEL_FALLBACK_SHOP);
}

const SANDBOX_OBJECTIVES = [
    { text: 'Survive Endless Traffic', colorClass: 'bg-red-500', pulse: true },
    { text: 'Route WEB traffic to Object Storage', colorClass: 'bg-green-500' },
    { text: 'Route API traffic to Database', colorClass: 'bg-yellow-500' },
    { text: 'Block FRAUD traffic with WAF', colorClass: 'bg-purple-500' }
];

const CAMPAIGN_INTRO_OBJECTIVES = [
    { text: "Choose the tutorial level to begin Baby's First Network.", colorClass: 'bg-blue-500', pulse: true },
    { text: 'Follow each mission briefing carefully to unlock the next node.', colorClass: 'bg-slate-500' }
];

function setObjectivesTitle(text) {
    const title = document.getElementById('objectives-title');
    if (title) title.innerText = text;
}

function renderObjectives(entries) {
    const list = document.getElementById('objectives-list');
    if (!list) return;
    list.innerHTML = '';
    entries.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'flex items-center';
        const dot = document.createElement('span');
        dot.className = `w-2 h-2 rounded-full mr-2 ${entry.colorClass || 'bg-gray-500'}`;
        if (entry.pulse) dot.classList.add('animate-pulse');
        li.appendChild(dot);
        const text = document.createElement('span');
        text.innerText = entry.text;
        li.appendChild(text);
        list.appendChild(li);
    });
}

function setSandboxObjectivesPanel() {
    setObjectivesTitle('Current Objectives');
    renderObjectives(SANDBOX_OBJECTIVES);
}

function setCampaignIntroObjectives() {
    setObjectivesTitle('Campaign Briefing');
    renderObjectives(CAMPAIGN_INTRO_OBJECTIVES);
}

function setCampaignLevelObjectives(levelId) {
    const level = LEVELS[levelId];
    if (!level) {
        setCampaignIntroObjectives();
        return;
    }
    const instructions = (level.instructions || []).map(text => ({ text, colorClass: 'bg-blue-500' }));
    setObjectivesTitle(level.title || 'Campaign Objectives');
    renderObjectives(instructions.length ? instructions : [{ text: 'Follow the briefing to succeed.', colorClass: 'bg-blue-500' }]);
}

function loadLevelConfig(levelId) {
    const level = LEVELS[levelId];
    if (!level) {
        console.error('Attempted to load missing level', levelId);
        return;
    }

    resetSimulationState();
    if (level.preplacedNodes) level.preplacedNodes.forEach(spawnNodeFromConfig);
    applyToolbarWhitelist(level.toolbarWhitelist);
    setBudget(level.startingBudget !== undefined ? level.startingBudget : 0);
    resetSatisfaction();
    resetScore();
    setTrafficProfile(level.trafficProfile);
    setLevelHeader(level.title, level.subtitle);
    setLevelDescription(level.description);
    setLevelInstructions(level.instructions);
    setCurrentLevelContext(levelId);
    setShopForLevel(levelId);
    setCampaignLevelObjectives(levelId);
    updateCampaignHighlights(levelId);
}

function resetLevel() {
    if (!isCampaignMode() || !getCurrentLevelId()) return;
    loadLevelConfig(getCurrentLevelId());
}
window.resetLevel = resetLevel;

function exitLevelToCampaignHub() {
    if (!isCampaignMode()) return;
    GameContext.mode = GAME_MODES.CAMPAIGN;
    GameContext.currentLevelId = null;
    setCampaignUIActive(true);
    resetSimulationState();
    setTrafficProfile(null);
    updateCampaignHighlights(null);
    showLevelInstructionsPanel(false);
    setCampaignIntroObjectives();
    setCampaignShop();
    showView('campaign');
    STATE.isRunning = false;
}
window.exitLevelToCampaignHub = exitLevelToCampaignHub;

function getCampaignStorageKey(levelId) {
    return `campaign_${levelId}_complete`;
}

function markLevelComplete(levelId) {
    try {
        localStorage.setItem(getCampaignStorageKey(levelId), 'true');
    } catch (error) {
        console.warn('Unable to skip localStorage write', error);
    }
}

function isLevelComplete(levelId) {
    try {
        return localStorage.getItem(getCampaignStorageKey(levelId)) === 'true';
    } catch (error) {
        return false;
    }
}

function isLevelUnlocked(level) {
    if (!level) return false;
    if (level.id === 'baby-1') return true;
    const prerequisite = LEVEL_UNLOCK_CHAIN[level.id];
    return prerequisite ? isLevelComplete(prerequisite) : true;
}

function renderCampaignLevels() {
    const list = document.getElementById('campaign-level-list');
    if (!list) return;
    list.innerHTML = '';
    BABYS_FIRST_NETWORK_LEVELS.forEach((level) => {
        const unlocked = isLevelUnlocked(level);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = !unlocked;
        btn.className = `w-full text-left rounded-2xl border p-5 transition ${unlocked ? 'border-white/30 hover:border-blue-400 hover:shadow-[0_0_20px_rgba(66,153,225,0.25)]' : 'border-gray-700 text-gray-400 opacity-70 cursor-not-allowed bg-gray-900/40'}`;
        btn.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-[11px] uppercase tracking-[0.5em] text-gray-500 font-mono">baby's first network</p>
                    <p class="text-xl font-semibold text-white">${level.title || level.name}</p>
                    <p class="text-sm text-gray-400 mt-1">${level.subtitle || ''}</p>
                </div>
                <span class="text-xs font-bold uppercase ${unlocked ? 'text-blue-300' : 'text-gray-500'}">${unlocked ? 'Play' : 'Locked'}</span>
            </div>
        `;
        btn.addEventListener('click', () => {
            if (!unlocked) return;
            window.startCampaignLevel(level.id);
        });
        list.appendChild(btn);
    });
}

function setCampaignLevelsVisible(visible) {
    const levelsSection = document.getElementById('campaign-levels');
    const worlds = document.getElementById('campaign-worlds');
    if (!levelsSection || !worlds) return;
    levelsSection.classList.toggle('hidden', !visible);
    worlds.classList.toggle('hidden', visible);
    if (visible) renderCampaignLevels();
}

function hideCampaignLevels() {
    setCampaignLevelsVisible(false);
}

window.hideCampaignLevels = hideCampaignLevels;

window.enterCampaignWorld = (worldId) => {
    console.info(`[Campaign] viewing levels for ${worldId}`);
    setCampaignLevelsVisible(true);
};

function createService(type, pos) {
    const service = CONFIG.services[type];
    if (!service) return;
    if (STATE.money < CONFIG.services[type].cost) { flashMoney(); return; }
    if (STATE.services.find(s => s.position.distanceTo(pos) < 1)) return;
    STATE.money -= CONFIG.services[type].cost;
    STATE.services.push(new Service(type, pos));
    STATE.sound.playPlace();
}

function createConnection(fromId, toId) {
    if (fromId === toId) return;
    const getEntity = (id) => id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);
    const from = getEntity(fromId), to = getEntity(toId);
    if (!from || !to || from.connections.includes(toId)) return;

    // Relaxed connection rules: Allow any connection between distinct nodes
    // Removed hardcoded topology checks

    new Audio('assets/sounds/click-5.mp3').play();

    from.connections.push(toId);
    to.connections.push(fromId);
    const pts = [from.position.clone(), to.position.clone()];
    pts[0].y = pts[1].y = 1;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: CONFIG.colors.line });
    const line = new THREE.Line(geo, mat);
    connectionGroup.add(line);
    
    const linkId = 'link_' + Math.random().toString(36).substr(2, 9);
    STATE.connections.push({ id: linkId, from: fromId, to: toId, mesh: line });
    STATE.sound.playConnect();
}

function deleteLink(link) {
    if (!link) return;
    
    // Remove from source node's connections list
    const getEntity = (id) => id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);
    const fromNode = getEntity(link.from);
    if (fromNode) {
        fromNode.connections = fromNode.connections.filter(id => id !== link.to);
    }

    const toNode = getEntity(link.to);
    if (toNode) {
        toNode.connections = toNode.connections.filter(id => id !== link.from);
    }

    // Remove mesh
    connectionGroup.remove(link.mesh);
    link.mesh.geometry.dispose();
    link.mesh.material.dispose();

    // Remove from state
    STATE.connections = STATE.connections.filter(c => c.id !== link.id);
    STATE.sound.playDelete();
}

function deleteObject(id) {
    const svc = STATE.services.find(s => s.id === id);
    if (!svc) return;

    // Find all links connected to this node
    const linksToRemove = STATE.connections.filter(c => c.from === id || c.to === id);
    linksToRemove.forEach(link => deleteLink(link));

    svc.destroy();
    STATE.services = STATE.services.filter(s => s.id !== id);
    STATE.money += Math.floor(svc.config.cost / 2);
    STATE.sound.playDelete();
}

/**
 * Calculates the percentage if failure based on the load of the node.
 * @param {number} load fractions of 1 (0 to 1) of how loaded the node is
 * @returns {number} chance of failure (0 to 1)
 */
function calculateFailChanceBasedOnLoad(load) {
    const clamped = Math.max(0, Math.min(1, load));
    if (clamped <= 0.8) return 0;
    return (clamped - 0.8) / 0.2;
}
window.calculateFailChanceBasedOnLoad = calculateFailChanceBasedOnLoad;

function getToolId(t) {
    const map = {
        'waf': 'tool-waf',
        'loadBalancer': 'tool-lb',
        'compute': 'tool-compute',
        'database': 'tool-db',
        'objectStorage': 'tool-objstore'
    };
    return map[t] || `tool-${t}`;
}

window.setTool = (t) => {
    STATE.activeTool = t; STATE.selectedNodeId = null;
    document.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(getToolId(t)).classList.add('active');
    new Audio('assets/sounds/click-9.mp3').play();
};

window.setTimeScale = (s) => {
    STATE.timeScale = s;
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));

    if (s === 0) {
        document.getElementById('btn-pause').classList.add('active');
        document.getElementById('btn-play').classList.add('pulse-green');
    } else if (s === 1) {
        document.getElementById('btn-play').classList.add('active');
        document.getElementById('btn-play').classList.remove('pulse-green');
    } else if (s === 3) {
        document.getElementById('btn-fast').classList.add('active');
        document.getElementById('btn-play').classList.remove('pulse-green');
    }
};

window.toggleMute = () => {
    const muted = STATE.sound.toggleMute();
    const icon = document.getElementById('mute-icon');
    const menuIcon = document.getElementById('menu-mute-icon');

    const iconText = muted ? '🔇' : '🔊';
    if (icon) icon.innerText = iconText;
    if (menuIcon) menuIcon.innerText = iconText;

    const muteBtn = document.getElementById('tool-mute');
    const menuMuteBtn = document.getElementById('menu-mute-btn'); // We need to add ID to menu button

    if (muted) {
        muteBtn.classList.add('bg-red-900');
        muteBtn.classList.add('pulse-green');
        if (menuMuteBtn) menuMuteBtn.classList.add('pulse-green');
    } else {
        muteBtn.classList.remove('bg-red-900');
        muteBtn.classList.remove('pulse-green');
        if (menuMuteBtn) menuMuteBtn.classList.remove('pulse-green');
    }
};

document.addEventListener('mousemove', (e) => {
    if (!renderer) return;

    if (isPanning) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
    
        // Adjust panning direction based on camera rotation
        // For isometric view (45 deg rotation), we need to rotate the input vector
        // But since we are using an orthographic camera with lookAt(0,0,0), simple X/Z panning relative to camera works best
        
        // Move camera opposite to mouse movement
        camera.position.x -= dx * panSpeed;
        camera.position.z -= dy * panSpeed;
        // Also move target to keep looking at same relative point if needed, 
        // but for Ortho camera looking at 0,0,0, moving position is enough if we don't re-lookAt every frame
        // However, resetCamera() calls lookAt. Let's just move position.
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
    }

    if (isDraggingNode && draggedNode) {
        const i = getIntersect(e.clientX, e.clientY);
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        
        const snapped = snapToGrid(target);
        draggedNode.position.copy(snapped);
        draggedNode.mesh.position.x = snapped.x;
        draggedNode.mesh.position.z = snapped.z;
        
        updateLinkVisuals(draggedNode.id);
        return;
    }

    if (e.target !== renderer.domElement) {
        document.getElementById('tooltip').style.display = 'none';
        STATE.hovered = null;
        return;
    }

    const i = getIntersect(e.clientX, e.clientY);
    STATE.hovered = i;

    // Tooltip logic
    const tooltip = document.getElementById('tooltip');
    if (i.type === 'service' || i.type === 'link') {
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.style.display = 'block';
    } else {
        tooltip.style.display = 'none';
    }
});

document.addEventListener('mousedown', (e) => {
    if (!renderer) return;

    if (e.target !== renderer.domElement) return;

    if (e.button === 2 || e.button === 1) { // Right or Middle click
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        container.style.cursor = 'move';
    }

    if (e.button === 0) { // Left mouse button
        const i = getIntersect(e.clientX, e.clientY);

        if (STATE.activeTool === 'select') {
            if (i.type === 'service') {
                isDraggingNode = true;
                draggedNode = STATE.services.find(s => s.id === i.id);
                container.style.cursor = 'grabbing';
                STATE.selectedNodeId = i.id;
            } else {
                STATE.selectedNodeId = null;
            }
        } else if (STATE.activeTool === 'delete') {
            if (i.type === 'service') deleteObject(i.id);
            else if (i.type === 'link') deleteLink(i.link);
        } else if (STATE.activeTool === 'connect') {
            if (i.type === 'service' || i.type === 'internet') {
                if (!STATE.selectedNodeId) {
                    STATE.selectedNodeId = i.id;
                    // Optional: Add visual feedback for source selection here
                } else {
                    createConnection(STATE.selectedNodeId, i.id);
                    STATE.selectedNodeId = null;
                }
            } else {
                STATE.selectedNodeId = null;
            }
        } else {
            // Placement tools
            if (i.type === 'ground') {
                createService(STATE.activeTool, snapToGrid(i.pos));
            }
        }
    }
});

document.addEventListener('mouseup', (e) => {
    if (!renderer) return;

    if (e.button === 0) { // Left mouse button
        isDraggingNode = false;
        draggedNode = null;
        container.style.cursor = 'auto';
    }
    
    if (e.button === 2 || e.button === 1) {
        isPanning = false;
        container.style.cursor = 'default';
    }
    
    if (isDraggingNode) {
        isDraggingNode = false;
        draggedNode = null;
        container.style.cursor = 'default';
    }
});

export function gameFrame(time) {
    const lastTime = STATE.lastTime ?? time;
    const delta = (time - lastTime) / 1000;
    STATE.lastTime = time;

    if (!STATE.isRunning) {
        if (!renderer) return;
        renderer.render(scene, camera);
        return;
    }

    // Spawn requests
    STATE.spawnTimer += delta * STATE.timeScale;
    if (STATE.spawnTimer > 1 / STATE.currentRPS) {
        spawnRequest();
        STATE.spawnTimer = 0;
    }

    // Difficulty Ramp
    if (STATE.gameMode === 'survival') {
        STATE.currentRPS += CONFIG.survival.rampUp * delta * STATE.timeScale;
    }

    // Update entities
    STATE.services.forEach(s => s.update(delta * STATE.timeScale));
    STATE.requests.forEach(r => r.update(delta * STATE.timeScale));

    // Update UI
    document.getElementById('rps-display').innerText = `${STATE.currentRPS.toFixed(1)} req/s`;
    document.getElementById('money-display').innerText = `$${STATE.money.toFixed(2)}`;

    const totalUpkeep = STATE.services.reduce((sum, s) => sum + (s.config.upkeep / 60), 0);
    document.getElementById('upkeep-display').innerText = `-$${totalUpkeep.toFixed(2)}/s`;
    
    updateTooltip();

    // Check game over
    if (STATE.reputation <= 0 || STATE.money <= -1000) {
        STATE.isRunning = false;
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('modal-title').innerText = STATE.reputation <= 0 ? 'REPUTATION LOST' : 'BANKRUPT';
        document.getElementById('modal-desc').innerText = STATE.reputation <= 0 ? 'Users have abandoned your platform.' : 'Funding has been cut.';
    }

    renderer.render(scene, camera);
}

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') {
        resetCamera();
    }
    if (e.key.toLowerCase() === 't') {
        toggleCameraMode();
    }
    if (e.key.toLowerCase() === 'h') {
        const ui = document.getElementById('statsPanel');
        ui.classList.toggle('hidden');
    }
});

// Prevent context menu on right click
document.addEventListener('contextmenu', event => event.preventDefault());