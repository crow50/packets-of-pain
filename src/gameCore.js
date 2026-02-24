import { resetCamera, serviceGroup, connectionGroup, requestGroup } from "./render/scene.js";
import { resetEconomyForMode } from "./sim/economy.js";
import { initTrafficForMode } from "./sim/traffic.js";
import { GAME_MODES } from "./modes/constants.js";
import { getRuntimeEngine, getRuntime } from "./utils/runtime.js";
import { restartCurrentMode } from "./core/modeManager.js";

import SoundService from "./services/SoundService.js";
let menuSound = null;
export function getMenuSound() {
    return menuSound;
}
export function setMenuSound(sound) {
    menuSound = sound;
}
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

// Centralized return to main menu function
export function returnToMainMenu() {
    getRuntime()?.stop?.();
    stopTutorial();
    showView('main-menu');
}

function getEngine() {
    return getRuntimeEngine();
}


export function initGame() {
    // Sound will be initialized when engine starts
    // Initial sound service created here for menu
    if (typeof window.SoundService !== 'undefined' && !menuSound) {
        menuSound = new SoundService();
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
    if (!ui?.sound && menuSound) {
        engine?.setSoundService(menuSound);
    }
    
    const sound = ui?.sound || menuSound;
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
    restartCurrentMode();
}


function isCampaignMode() {
    return getEngine()?.getActiveMode() === GAME_MODES.CAMPAIGN;
}
function getCurrentLevelId() {
    return getEngine()?.getCampaignLevel();
}

export function resetSimulationState() {
    initTrafficForMode(GAME_MODES.SANDBOX);
    resetEconomyForMode(GAME_MODES.SANDBOX, { startBudget: 0, initialTimeScale: 1 });
    clearAllNodesAndLinks();
}

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
