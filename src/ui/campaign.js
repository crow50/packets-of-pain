import { GameContext, setBudget, resetSatisfaction, resetScore, setTrafficProfile } from "../sim/economy.js";
import { updateScore } from "../sim/traffic.js";
import { setShopForLevel, setCampaignShop } from "./shop.js";
import { 
    showView, 
    setCampaignIntroObjectives, 
    showCampaignPanel,
    setCampaignPanelTitle,
    setCampaignPanelSeries,
    setCampaignPanelIntro,
    renderCampaignObjectives
} from "./hud.js";
import { applyToolbarWhitelist } from "./toolbarController.js";
import { getDomainById, getLevelById, getLevelsForDomain } from "../config/campaign/index.js";
import { configureTutorial, stopTutorial } from "./tutorialController.js";
import { configureLevelConditions, resetLevelConditions } from "./levelConditions.js";
import Service from "../entities/Service.js";
import { copyPosition, toPlainPosition, toPosition } from "../sim/vectorUtils.js";
import { linkInternetMesh } from "../render/scene.js";

const BABY_DOMAIN_ID = "babys-first-network";
const LEVEL_UNLOCK_CHAIN = {
    "baby-2": "baby-1",
    "baby-3": "baby-2",
};

export const GAME_MODES = {
    SANDBOX: "sandbox",
    CAMPAIGN: "campaign",
};

function spawnNodeFromConfig(nodeConfig) {
    if (!nodeConfig || !nodeConfig.type) return null;
    const engine = window.__POP_RUNTIME__?.current?.engine;
    const sim = engine?.getSimulation?.();
    if (!engine || !sim) {
        console.warn('[Campaign] Unable to spawn node, missing engine or simulation state.');
        return null;
    }

    const typeKey = String(nodeConfig.type).toLowerCase();
    if (typeKey === 'internet') {
        if (sim.internetNode && nodeConfig.position) {
            copyPosition(sim.internetNode.position, toPosition(nodeConfig.position));
            linkInternetMesh(sim.internetNode);
        }
        return sim.internetNode;
    }

    const catalog = window.ServiceCatalog;
    const catalogEntry = catalog?.getServiceType?.(nodeConfig.type);
    if (!catalogEntry) {
        console.warn('[Campaign] Unknown preplaced node type:', nodeConfig.type);
        return null;
    }

    const runtimeType = catalogEntry.key || typeKey;
    const service = new Service(runtimeType, nodeConfig.position || { x: 0, y: 0, z: 0 });
    if (nodeConfig.id) {
        service.id = nodeConfig.id;
    }

    if (Number.isFinite(nodeConfig.tier) && nodeConfig.tier > 1 && catalog?.getCapacityForTier) {
        const tierCapacity = catalog.getCapacityForTier(runtimeType, nodeConfig.tier);
        if (tierCapacity) {
            service.tier = nodeConfig.tier;
            service.config.capacity = tierCapacity;
            service.load.lastTickCapacity = tierCapacity;
        }
    }

    service.isCampaignPreplaced = true;
    const lockPosition = nodeConfig.lockPosition ?? nodeConfig.locked;
    service.positionLocked = lockPosition !== undefined
        ? Boolean(lockPosition)
        : service.type === 'user';
    sim.services.push(service);
    engine.emit?.('serviceAdded', {
        serviceId: service.id,
        type: service.type,
        position: toPlainPosition(service.position),
        preplaced: true
    });
    window.Routing?.validateTopology?.();
    return service;
}

export function showLevelInstructionsPanel(visible) {
    showCampaignPanel(visible);
}

function setLevelHeader(title, series) {
    setCampaignPanelTitle(title || 'Campaign Objectives');
    setCampaignPanelSeries(series || "baby's first network");
}

function setLevelDescription(text) {
    setCampaignPanelIntro(text || '');
}

function setLevelInstructions(instructions = []) {
    // Instructions are now shown as objectives in the unified panel
    const entries = instructions.map(text => ({ text, colorClass: 'bg-blue-500' }));
    renderCampaignObjectives(entries.length ? entries : [{ text: 'Follow the briefing to succeed.', colorClass: 'bg-blue-500' }]);
}

function setCurrentLevelContext(levelId) {
    GameContext.currentLevelId = levelId;
}

function resolveTopologyGuidance(level) {
    if (level && Array.isArray(level.topologyGuidance) && level.topologyGuidance.length) {
        return level.topologyGuidance;
    }
    if (!level) return [];
    const domain = getDomainById(level.domainId);
    if (domain && Array.isArray(domain.topologyGuidance) && domain.topologyGuidance.length) {
        return domain.topologyGuidance;
    }
    return [];
}

function setTopologyGuidanceFromLevel(level) {
    GameContext.topologyGuidance = resolveTopologyGuidance(level);
}

function clearTopologyGuidance() {
    GameContext.topologyGuidance = [];
}

function setCampaignLevelObjectives(levelId) {
    const level = getLevelById(levelId);
    if (!level) {
        setCampaignIntroObjectives();
        return;
    }
    // Level objectives are set by setLevelInstructions in loadLevelConfig
    // This function ensures fallback objectives if level has none
}

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

export function renderCampaignLevels() {
    const list = document.getElementById('campaign-level-list');
    if (!list) return;
    list.innerHTML = '';
    getLevelsForDomain(BABY_DOMAIN_ID).forEach((level) => {
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
            window.POP?.startCampaignLevel?.(level.id);
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

export function hideCampaignLevels() {
    setCampaignLevelsVisible(false);
}

export function enterCampaignWorld(worldId) {
    console.info(`[Campaign] viewing levels for ${worldId}`);
    setCampaignLevelsVisible(true);
}

export function loadLevelConfig(levelId) {
    const level = getLevelById(levelId);
    if (!level) {
        console.error('Attempted to load missing level', levelId);
        return;
    }

    window.resetSimulationState?.();
    // Ensure campaign levels start paused so player can build
    window.setTimeScale?.(0);
    
    if (level.preplacedNodes) level.preplacedNodes.forEach(spawnNodeFromConfig);
    applyToolbarWhitelist(level.toolbarWhitelist);
    setBudget(level.startingBudget !== undefined ? level.startingBudget : 0);
    resetSatisfaction();
    resetScore();
    updateScore();
    setTrafficProfile(level.trafficProfile);
    setLevelHeader(level.title, level.subtitle);
    setLevelDescription(level.description);
    setLevelInstructions(level.instructions);
    setCurrentLevelContext(levelId);
    setTopologyGuidanceFromLevel(level);
    setShopForLevel(levelId);
    setCampaignLevelObjectives(levelId);
    const engine = window.__POP_RUNTIME__?.current?.engine;
    stopTutorial();
    configureTutorial(level, engine);
    configureLevelConditions(level);
}

export function startCampaign() {
    GameContext.mode = GAME_MODES.CAMPAIGN;
    clearTopologyGuidance();
    stopTutorial();
    resetLevelConditions();
    window.setCampaignUIActive?.(true);
    setCampaignShop();
    showView('campaign-hub');
    setCampaignIntroObjectives();
}

export function startCampaignLevel(levelId) {
    const level = getLevelById(levelId);
    if (!level) {
        console.error('Unknown levelId', levelId);
        return;
    }
    GameContext.mode = GAME_MODES.CAMPAIGN;
    GameContext.currentLevelId = levelId;
    setTopologyGuidanceFromLevel(level);
    window.setCampaignUIActive?.(true);
    showLevelInstructionsPanel(true);
    showView('campaign');
    loadLevelConfig(levelId);
    markLevelComplete(levelId);
    renderCampaignLevels();
}

export function resetLevel() {
    if (GameContext.mode !== GAME_MODES.CAMPAIGN || !GameContext.currentLevelId) return;
    loadLevelConfig(GameContext.currentLevelId);
}

export function exitLevelToCampaignHub() {
    if (GameContext.mode !== GAME_MODES.CAMPAIGN) return;
    GameContext.mode = GAME_MODES.CAMPAIGN;
    GameContext.currentLevelId = null;
    clearTopologyGuidance();
    stopTutorial();
    resetLevelConditions();
    window.setCampaignUIActive?.(true);
    window.resetSimulationState?.();
    setTrafficProfile(null);
    showLevelInstructionsPanel(false);
    setCampaignIntroObjectives();
    setCampaignShop();
    showView('campaign-hub');
    window.__POP_RUNTIME__?.current?.engine?.setRunning(false);
}
