import { switchToMode } from "../core/modeManager.js";
import { GAME_MODES } from "../modes/constants.js";
import { startCampaign } from "./campaign.js";
import { getLevelById } from "../config/campaign/index.js";
import { getScenarioById } from "../config/scenarios/index.js";

const DEFAULT_INTERNET_POSITION = { x: -10, y: 0, z: 0 };

export function startSandbox() {
    switchToMode(GAME_MODES.SANDBOX, {
        internetPosition: DEFAULT_INTERNET_POSITION
    });
}

export function startCampaignEntry() {
    startCampaign();
}

export function startCampaignLevel(levelId) {
    const level = getLevelById(levelId);
    if (!level) {
        console.error('Unknown level id', levelId);
        return;
    }
    switchToMode(GAME_MODES.CAMPAIGN, { levelId });
}

export function startScenario(scenarioId) {
    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
        console.error('[Scenarios] Unknown scenario id', scenarioId);
        return;
    }
    switchToMode(GAME_MODES.SCENARIOS, {
        scenarioId: scenario.id,
        scenarioConfig: scenario,
        startBudget: typeof scenario.startingBudget === 'number' ? scenario.startingBudget : undefined,
        packetIncreaseInterval: typeof scenario.packetIncreaseInterval === 'number' ? scenario.packetIncreaseInterval : undefined,
        trafficProfile: scenario.trafficProfile || null,
        internetPosition: scenario.internetPosition || undefined
    });
}
