import { GAME_MODES } from "./constants.js";
import { resetGame } from "../gameCore.js";
import { startCampaign, startCampaignLevel, initCampaignEngine } from "../ui/campaign.js";
import { setModeBehaviors, resetModeBehaviors } from "./modeBehaviors.js";
import { campaignTrafficSourceBehavior } from "./trafficBehaviors.js";
import { showCampaignPanel } from "../ui/hud.js";

export const CampaignModeController = {
    id: GAME_MODES.CAMPAIGN,
    init({ engine, modeConfig } = {}) {
        initCampaignEngine(engine);
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
    teardown({ engine } = {}) {
        resetModeBehaviors();
        showCampaignPanel(false);
        const eng = engine;
        eng?.setCampaignLevel?.(null);
        eng?.setTopologyGuidance?.([]);
    },
    onTick() {},
    onGameOver() {}
};
