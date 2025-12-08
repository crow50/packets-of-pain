import { GAME_MODES } from "./constants.js";
import { resetGame } from "../gameCore.js";
import { setModeBehaviors, resetModeBehaviors } from "./modeBehaviors.js";
import { campaignTrafficSourceBehavior } from "./trafficBehaviors.js";
import { loadScenarioSession, openScenariosBrowser, initScenariosEngine } from "../ui/scenariosController.js";
import { showScenarioPanel } from "../ui/hud.js";

export const ScenariosModeController = {
    id: GAME_MODES.SCENARIOS,
    init({ engine, modeConfig } = {}) {
        console.info('[Scenarios] Initializing scenario mode', modeConfig);
        const scenarioId = modeConfig?.scenarioId || null;
        initScenariosEngine(engine);
        const eng = engine;
        eng?.setActiveMode?.(GAME_MODES.SCENARIOS);
        eng?.setScenarioId?.(scenarioId);
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
    teardown({ engine } = {}) {
        resetModeBehaviors();
        const eng = engine;
        eng?.setScenarioId?.(null);
        showScenarioPanel(false);
    },
    onTick() {},
    onGameOver() {}
};
