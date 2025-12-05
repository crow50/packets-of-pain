import { GAME_MODES } from "./constants.js";
import { CampaignModeController } from "./campaignMode.js";
import { SandboxModeController } from "./sandboxMode.js";
import { ScenariosModeController } from "./scenariosMode.js";

const CONTROLLERS = new Map([
    [GAME_MODES.CAMPAIGN, CampaignModeController],
    [GAME_MODES.SANDBOX, SandboxModeController],
    [GAME_MODES.SCENARIOS, ScenariosModeController]
]);

export function getModeController(modeId = GAME_MODES.SANDBOX) {
    return CONTROLLERS.get(modeId) || SandboxModeController;
}

export function registerModeController(modeId, controller) {
    if (!modeId || typeof controller !== 'object') return;
    CONTROLLERS.set(modeId, controller);
}

export function listModeControllers() {
    return Array.from(CONTROLLERS.values());
}
