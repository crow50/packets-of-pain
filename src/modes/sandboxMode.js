import { GAME_MODES } from "./constants.js";
import { resetGame } from "../gameCore.js";
import { setModeBehaviors, resetModeBehaviors } from "./modeBehaviors.js";
import { setActiveMode, setCampaignLevel, setTopologyGuidance } from "./modeState.js";
import { setTrafficProfile } from "../sim/economy.js";
import { setTool } from "../sim/tools.js";
import { stopTutorial } from "../ui/tutorialController.js";
import { enterSandboxHUD } from "../ui/sandboxMode.js";
import { hideSandboxPanel } from "../ui/sandboxController.js";

export const SandboxModeController = {
    id: GAME_MODES.SANDBOX,
    init() {
        stopTutorial();
        setActiveMode(GAME_MODES.SANDBOX);
        setCampaignLevel(null);
        setTopologyGuidance([]);
        setTrafficProfile(null);
        enterSandboxHUD();
        setTool('select');
        resetGame(GAME_MODES.SANDBOX);
        setModeBehaviors({
            shouldAllowGameOver: () => false
        });
    },
    teardown() {
        resetModeBehaviors();
        hideSandboxPanel();
        setTopologyGuidance([]);
    },
    onTick() {},
    onGameOver() {}
};
