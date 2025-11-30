import { GAME_MODES } from "../modes/constants.js";
import { setModeUIActive, showView } from "./hud.js";
import { setSandboxShop } from "./shop.js";

/**
 * Centralizes sandbox-specific HUD/menu toggles so the mode controller
 * can enable the correct view without poking at globals.
 */
export function enterSandboxHUD() {
    setModeUIActive(GAME_MODES.SANDBOX, { showObjectives: false });
    setSandboxShop();
    showView('sandbox');
}
