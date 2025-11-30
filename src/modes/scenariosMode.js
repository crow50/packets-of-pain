import { GAME_MODES } from "./constants.js";
import { setActiveMode, setScenarioId } from "./modeState.js";
import { resetGame } from "../gameCore.js";
import { setModeBehaviors, resetModeBehaviors } from "./modeBehaviors.js";
import { campaignTrafficSourceBehavior } from "./trafficBehaviors.js";
import { loadScenarioSession, openScenariosBrowser } from "../ui/scenariosController.js";

export const ScenariosModeController = {
    id: GAME_MODES.SCENARIOS,
    init({ modeConfig } = {}) {
        console.info('[Scenarios] Initializing scenario mode', modeConfig);
        const scenarioId = modeConfig?.scenarioId || null;
        setActiveMode(GAME_MODES.SCENARIOS);
        setScenarioId(scenarioId);
        resetGame(GAME_MODES.SCENARIOS);
        setModeBehaviors({
            pickTrafficSource: campaignTrafficSourceBehavior,
            shouldAllowGameOver: () => true
        });

        if (scenarioId) {
            const loaded = loadScenarioSession(scenarioId, modeConfig?.scenarioConfig || null);
            if (!loaded) {
                openScenariosBrowser('menu');
            }
        } else {
            openScenariosBrowser('menu');
        }
    },
    teardown() {
        resetModeBehaviors();
        setScenarioId(null);
    },
    onTick() {},
    onGameOver() {}
};
