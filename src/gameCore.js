import { resetCamera, serviceGroup, connectionGroup, requestGroup } from "./render/scene.js";
import { GameContext, resetEconomyForMode, setTrafficProfile } from "./sim/economy.js";
import { initTrafficForMode } from "./sim/traffic.js";

const SoundService = typeof window !== "undefined" ? window.SoundService : undefined;
import {
    showView,
    showMainMenu,
    showFAQ,
    closeFAQ,
    showObjectivesPanel,
} from "./ui/hud.js";
import {
    setSandboxShop
} from "./ui/shop.js";
import {
    GAME_MODES,
    resetLevel,
    exitLevelToCampaignHub,
    hideCampaignLevels,
    enterCampaignWorld,
    updateCampaignHighlights,
    showLevelInstructionsPanel
} from "./ui/campaign.js";
import {
    setTool,
    createService,
    createConnection,
    deleteLink,
    deleteObject
} from "./sim/tools.js";

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
    showView('main-menu');
};

function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}


function updateGameModeLabel(isCampaign) {
    const label = document.getElementById('game-mode-label');
    if (!label) return;
    label.innerText = isCampaign ? 'CAMPAIGN' : 'SURVIVAL';
    label.classList.toggle('text-blue-400', isCampaign);
    label.classList.toggle('text-red-500', !isCampaign);
}

function setCampaignUIActive(active) {
    document.body.classList.toggle('campaign-mode', active);
    // Show objectives panel only in campaign mode
    showObjectivesPanel(active);
    updateGameModeLabel(active);
    if (!active) {
        showLevelInstructionsPanel(false);
        updateCampaignHighlights(null);
    }
}
window.setCampaignUIActive = setCampaignUIActive;

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

export function resetGame(mode = 'survival') {
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
    document.getElementById('modal').classList.add('hidden');
    window.POP?.restartCurrentMode?.();
}
window.restartGame = restartGame;


export function startSandbox() {
    GameContext.mode = GAME_MODES.SANDBOX;
    setCampaignUIActive(false);
    setSandboxShop();
    GameContext.currentLevelId = null;
    setTrafficProfile(null);
    showLevelInstructionsPanel(false);
    showView('sandbox');
    window.setTool('select');  
}

function isCampaignMode() {
    return GameContext.mode === GAME_MODES.CAMPAIGN;
}
window.isCampaignMode = isCampaignMode;

function getCurrentLevelId() {
    return GameContext.currentLevelId;
}
window.getCurrentLevelId = getCurrentLevelId;

function resetSimulationState() {
    initTrafficForMode('survival');
    resetEconomyForMode('survival', { startBudget: 0, initialTimeScale: 1 });
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
    connections.forEach(link => {
        if (link.mesh) {
            connectionGroup.remove(link.mesh);
            if (link.mesh.geometry) link.mesh.geometry.dispose();
            if (link.mesh.material) link.mesh.material.dispose();
        }
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