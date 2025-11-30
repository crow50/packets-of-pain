import { GAME_MODES } from "./constants.js";

const DEFAULT_STATE = {
    activeMode: GAME_MODES.SANDBOX,
    toolbarWhitelist: [],
    topologyGuidance: [],
    campaign: {
        currentLevelId: null,
        lastCompletedLevelId: null
    },
    sandbox: {},
    scenarios: {
        activeScenarioId: null
    }
};

const modeState = (typeof structuredClone === 'function')
    ? structuredClone(DEFAULT_STATE)
    : JSON.parse(JSON.stringify(DEFAULT_STATE));

export function getModeState() {
    return modeState;
}

export function setActiveMode(modeId) {
    modeState.activeMode = modeId;
}

export function getActiveMode() {
    return modeState.activeMode;
}

export function setToolbarWhitelist(list = []) {
    modeState.toolbarWhitelist = Array.isArray(list) ? [...list] : [];
}

export function getToolbarWhitelist() {
    return [...modeState.toolbarWhitelist];
}

export function setTopologyGuidance(entries = []) {
    modeState.topologyGuidance = Array.isArray(entries) ? [...entries] : [];
}

export function getTopologyGuidance() {
    return [...modeState.topologyGuidance];
}

export function setCampaignLevel(levelId) {
    modeState.campaign.currentLevelId = levelId || null;
}

export function getCampaignLevel() {
    return modeState.campaign.currentLevelId;
}

export function markCampaignLevelComplete(levelId) {
    modeState.campaign.lastCompletedLevelId = levelId || null;
}

export function setScenarioId(scenarioId) {
    modeState.scenarios.activeScenarioId = scenarioId || null;
}

export function getScenarioId() {
    return modeState.scenarios.activeScenarioId;
}

export function resetModeState() {
    const next = (typeof structuredClone === 'function')
        ? structuredClone(DEFAULT_STATE)
        : JSON.parse(JSON.stringify(DEFAULT_STATE));
    Object.keys(modeState).forEach(key => {
        if (typeof next[key] === "object" && next[key] !== null && !Array.isArray(next[key])) {
            Object.assign(modeState[key], next[key]);
        } else {
            modeState[key] = next[key];
        }
    });
}
