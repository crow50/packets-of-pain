import { GAME_MODES } from "./constants.js";
import { resetGame } from "../gameCore.js";
import { startCampaign, startCampaignLevel } from "../ui/campaign.js";
import { setModeBehaviors, resetModeBehaviors } from "./modeBehaviors.js";
import { campaignTrafficSourceBehavior } from "./trafficBehaviors.js";
import { showCampaignPanel } from "../ui/hud.js";
import { setActiveMode, setCampaignLevel, setTopologyGuidance } from "../modes/modeState.js";

export const CampaignModeController = {
    id: GAME_MODES.CAMPAIGN,
    init({ modeConfig } = {}) {
        resetGame(GAME_MODES.CAMPAIGN);
        setModeBehaviors({
            pickTrafficSource: campaignTrafficSourceBehavior,
            shouldAllowGameOver: () => true
        });
        if (modeConfig?.levelId) {
            startCampaignLevel(modeConfig.levelId);
        } else {
            startCampaign();
        }
    },
    teardown() {
        resetModeBehaviors();
        showCampaignPanel(false);
        setCampaignLevel(null);
        setTopologyGuidance([]);
    },
    onTick() {},
    onGameOver() {}
};
