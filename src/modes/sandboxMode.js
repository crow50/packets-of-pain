import { GAME_MODES } from "./constants.js";
import { resetGame } from "../gameCore.js";
import { setModeBehaviors, resetModeBehaviors } from "./modeBehaviors.js";
import { setTrafficProfile } from "../sim/economy.js";
import { setTool } from "../sim/tools.js";
import { stopTutorial } from "../ui/tutorialController.js";
import { enterSandboxHUD } from "../ui/sandboxMode.js";
import { hideSandboxPanel } from "../ui/sandboxController.js";

export const SandboxModeController = {
    id: GAME_MODES.SANDBOX,
    init({ engine } = {}) {
        stopTutorial();
        const eng = engine;
        eng?.setActiveMode?.(GAME_MODES.SANDBOX);
        eng?.setCampaignLevel?.(null);
        eng?.setTopologyGuidance?.([]);
        setTrafficProfile(null);
        enterSandboxHUD();
        setTool('select');
        resetGame(GAME_MODES.SANDBOX);
        setModeBehaviors({
            shouldAllowGameOver: () => false
        });
    },
    teardown({ engine } = {}) {
        resetModeBehaviors();
        hideSandboxPanel();
        const eng = engine;
        eng?.setTopologyGuidance?.([]);
    },
    onTick() {},
    onGameOver() {}
};
