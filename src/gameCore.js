import { resetCamera, serviceGroup, connectionGroup, requestGroup } from "./render/scene.js";
import { resetEconomyForMode } from "./sim/economy.js";
import { initTrafficForMode } from "./sim/traffic.js";
import { GAME_MODES } from "./modes/constants.js";

const SoundService = typeof window !== "undefined" ? window.SoundService : undefined;
import {
    showView,
    showMainMenu,
    showFAQ,
    closeFAQ
} from "./ui/hud.js";
import {
    resetLevel,
    exitLevelToCampaignHub,
    hideCampaignLevels,
    enterCampaignWorld,
} from "./ui/campaign.js";
import {
    setTool,
    createService,
    createConnection,
    deleteLink,
    deleteObject
} from "./sim/tools.js";
import { stopTutorial } from "./ui/tutorialController.js";

window.showView = showView;
window.showMainMenu = showMainMenu;
window.showFAQ = showFAQ;
window.closeFAQ = closeFAQ;
window.resetLevel = resetLevel;
window.exitLevelToCampaignHub = exitLevelToCampaignHub;
window.hideCampaignLevels = hideCampaignLevels;
window.enterCampaignWorld = enterCampaignWorld;
window.setTool = setTool;
window.createService = createService;
window.createConnection = createConnection;
window.deleteLink = deleteLink;
window.deleteObject = deleteObject;

// Centralized return to main menu function
window.returnToMainMenu = function() {
    window.__POP_RUNTIME__?.stop?.();
    stopTutorial();
    showView('main-menu');
};

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}


export function initGame() {
    // Sound will be initialized when engine starts
    // Initial sound service created here for menu
    if (typeof window.SoundService !== 'undefined' && !window.__menuSound) {
        window.__menuSound = new SoundService();
    }
    setTimeout(() => {
        showMainMenu();
    }, 100);
}

export function resetGame(mode = GAME_MODES.SANDBOX) {
    stopTutorial();
    const engine = getEngine();
    const ui = engine?.getUIState();
    const sim = engine?.getSimulation();
    
    // Reuse the menu sound service instead of creating a new one
    // This ensures sound state persists between menu and game
    if (!ui?.sound && window.__menuSound) {
        engine?.setSoundService(window.__menuSound);
    }
    
    const sound = ui?.sound || window.__menuSound;
    sound?.init?.();
    sound?.playGameBGM?.();
    resetEconomyForMode(mode);

    initTrafficForMode(mode);

    resetCamera();

    // Clear visual elements
    while (serviceGroup.children.length > 0) {
        serviceGroup.remove(serviceGroup.children[0]);
    }
    while (connectionGroup.children.length > 0) {
        connectionGroup.remove(connectionGroup.children[0]);
    }
    while (requestGroup.children.length > 0) {
        requestGroup.remove(requestGroup.children[0]);
    }
    if (sim?.internetNode) {
        sim.internetNode.connections = [];
    }
}

export function restartGame() {
    document.getElementById('game-over-modal').classList.add('hidden');
    window.POP?.restartCurrentMode?.();
}
window.restartGame = restartGame;


function isCampaignMode() {
    return getEngine()?.getActiveMode() === GAME_MODES.CAMPAIGN;
}
window.isCampaignMode = isCampaignMode;

function getCurrentLevelId() {
    return getEngine()?.getCampaignLevel();
}
window.getCurrentLevelId = getCurrentLevelId;

function resetSimulationState() {
    initTrafficForMode(GAME_MODES.SANDBOX);
    resetEconomyForMode(GAME_MODES.SANDBOX, { startBudget: 0, initialTimeScale: 1 });
    clearAllNodesAndLinks();
}
window.resetSimulationState = resetSimulationState;

function clearAllNodesAndLinks() {
    const engine = getEngine();
    const sim = engine?.getSimulation();
    
    const services = sim?.services || [];
    const requests = sim?.requests || [];
    const connections = sim?.connections || [];
    
    services.forEach(s => {
        if (s && typeof s.destroy === 'function') s.destroy();
    });
    requests.forEach(r => {
        if (r && typeof r.destroy === 'function') r.destroy();
    });
    while (serviceGroup.children.length) {
        serviceGroup.remove(serviceGroup.children[0]);
    }
    while (connectionGroup.children.length) {
        const child = connectionGroup.children[0];
        connectionGroup.remove(child);
    }
    while (requestGroup.children.length) {
        requestGroup.remove(requestGroup.children[0]);
    }

    if (sim) {
        sim.services = [];
        sim.requests = [];
        sim.connections = [];
        sim.internetNode.connections = [];
    }
}

/**
 * Calculates the percentage if failure based on the load of the node.
 * @param {number} load fractions of 1 (0 to 1) of how loaded the node is
 * @returns {number} chance of failure (0 to 1)
 */
function calculateFailChanceBasedOnLoad(load) {
    const clamped = Math.max(0, Math.min(1, load));
    if (clamped <= 0.8) return 0;
    return (clamped - 0.8) / 0.2;
}
window.calculateFailChanceBasedOnLoad = calculateFailChanceBasedOnLoad;

window.toggleMute = () => {
    const engine = getEngine();
    const sound = engine?.getUIState()?.sound || window.__menuSound;
    if (!sound) return;
    
    const muted = sound.toggleMute();
    
    // Update main menu mute button
    const menuIcon = document.getElementById('menu-mute-icon');
    const menuMuteBtn = document.getElementById('menu-mute-btn');
    
    const iconText = muted ? '🔇' : '🔊';
    if (menuIcon) menuIcon.innerText = iconText;

    if (muted) {
        if (menuMuteBtn) menuMuteBtn.classList.add('pulse-green');
    } else {
        if (menuMuteBtn) menuMuteBtn.classList.remove('pulse-green');
    }
    
    // Update hamburger menu sound status
    const hudSoundIcon = document.getElementById('hud-menu-sound-icon');
    const hudSoundStatus = document.getElementById('hud-menu-sound-status');
    if (hudSoundIcon) hudSoundIcon.innerText = iconText;
    if (hudSoundStatus) hudSoundStatus.textContent = muted ? 'Off' : 'On';
};