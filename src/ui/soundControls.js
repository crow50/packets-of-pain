import { getRuntimeEngine } from "../utils/runtime.js";
import { getMenuSound } from "../gameCore.js";

/**
 * Toggle mute state for the shared sound service.
 * Falls back to the menu sound handle if no engine is available.
 */
export function toggleMute(engineArg) {
    const engine = engineArg || getRuntimeEngine();
    const sound = engine?.getUIState()?.sound || getMenuSound();
    if (!sound) return;

    const muted = sound.toggleMute();

    // Update main menu mute button
    const menuIcon = document.getElementById('menu-mute-icon');
    const menuMuteBtn = document.getElementById('menu-mute-btn');
    const iconText = muted ? '🔇' : '🔊';
    if (menuIcon) menuIcon.innerText = iconText;
    if (menuMuteBtn) menuMuteBtn.classList.toggle('pulse-green', muted);

    // Update hamburger menu sound status
    const hudSoundIcon = document.getElementById('hud-menu-sound-icon');
    const hudSoundStatus = document.getElementById('hud-menu-sound-status');
    if (hudSoundIcon) hudSoundIcon.innerText = iconText;
    if (hudSoundStatus) hudSoundStatus.innerText = muted ? 'Off' : 'On';
}
