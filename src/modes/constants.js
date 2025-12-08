export const GAME_MODES = {
    SANDBOX: "sandbox",
    CAMPAIGN: "campaign",
    SCENARIOS: "scenarios"
};

export function isValidMode(modeId) {
    return Object.values(GAME_MODES).includes(modeId);
}
