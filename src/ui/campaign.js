import { LEVELS } from "../levels.js";
import { GameContext, setBudget, resetSatisfaction, resetScore, setTrafficProfile, applyToolbarWhitelist } from "../sim/economy.js";
import { updateScore } from "../sim/traffic.js";
import { setShopForLevel, setCampaignShop } from "./shop.js";
import { renderObjectives, setObjectivesTitle, showView, setCampaignIntroObjectives } from "./hud.js";

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

export const GAME_MODES = {
    SANDBOX: "sandbox",
    CAMPAIGN: "campaign",
};

function spawnNodeFromConfig(nodeConfig) {
    console.info('Spawning campaign node', nodeConfig);
}

export function updateCampaignHighlights(levelId) {
    const active = new Set(CAMPAIGN_HIGHLIGHT_MAP[levelId] || []);
    CAMPAIGN_HIGHLIGHT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('campaign-highlight', active.has(id));
    });
}

export function showLevelInstructionsPanel(visible) {
    const panel = document.getElementById('level-instructions-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
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
    const level = LEVELS[levelId];
    if (!level) {
        console.error('Attempted to load missing level', levelId);
        return;
    }

    window.resetSimulationState?.();
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
    setShopForLevel(levelId);
    setCampaignLevelObjectives(levelId);
    updateCampaignHighlights(levelId);
}

export function startCampaign() {
    GameContext.mode = GAME_MODES.CAMPAIGN;
    window.setCampaignUIActive?.(true);
    setCampaignShop();
    showView('campaign');
    setCampaignIntroObjectives();
}

export function startCampaignLevel(levelId) {
    const level = LEVELS[levelId];
    if (!level) {
        console.error('Unknown levelId', levelId);
        return;
    }
    GameContext.mode = GAME_MODES.CAMPAIGN;
    GameContext.currentLevelId = levelId;
    window.setCampaignUIActive?.(true);
    showLevelInstructionsPanel(true);
    showView('sandbox');
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
    window.setCampaignUIActive?.(true);
    window.resetSimulationState?.();
    setTrafficProfile(null);
    updateCampaignHighlights(null);
    showLevelInstructionsPanel(false);
    setCampaignIntroObjectives();
    setCampaignShop();
    showView('campaign');
    STATE.isRunning = false;
}
