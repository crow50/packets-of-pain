import {
    initScene,
    resetCamera,
    toggleCameraMode,
    scene,
    camera,
    renderer,
    serviceGroup,
    connectionGroup,
    requestGroup,
    internetMesh
} from "./render/scene.js";
import {
    initInteractions,
    getIntersect,
    snapToGrid,
    updateLinkVisuals,
    updateTooltip,
    raycaster,
    mouse,
    plane
} from "./render/interactions.js";
import {
    gameTick,
    initTrafficForMode
} from "./sim/traffic.js";
import {
    GameContext,
    resetEconomyForMode,
    setBudget,
    resetSatisfaction,
    resetScore,
    setTrafficProfile
} from "./sim/economy.js";
import {
    showView,
    showMainMenu,
    showFAQ,
    closeFAQ,
    setSandboxObjectivesPanel,
} from "./ui/hud.js";
import {
    setSandboxShop
} from "./ui/shop.js";
import {
    GAME_MODES,
    startCampaign,
    startCampaignLevel,
    resetLevel,
    exitLevelToCampaignHub,
    hideCampaignLevels,
    enterCampaignWorld,
    updateCampaignHighlights,
    showLevelInstructionsPanel
} from "./ui/campaign.js";

window.showView = showView;
window.showMainMenu = showMainMenu;
window.showFAQ = showFAQ;
window.closeFAQ = closeFAQ;
window.startCampaign = startCampaign;
window.startCampaignLevel = startCampaignLevel;
window.resetLevel = resetLevel;
window.exitLevelToCampaignHub = exitLevelToCampaignHub;
window.hideCampaignLevels = hideCampaignLevels;
window.enterCampaignWorld = enterCampaignWorld;


function updateGameModeLabel(isCampaign) {
    const label = document.getElementById('game-mode-label');
    if (!label) return;
    label.innerText = isCampaign ? 'CAMPAIGN' : 'SURVIVAL';
    label.classList.toggle('text-blue-400', isCampaign);
    label.classList.toggle('text-red-500', !isCampaign);
}

function setCampaignUIActive(active) {
    document.body.classList.toggle('campaign-mode', active);
    const objectivesPanel = document.getElementById('objectivesPanel');
    if (objectivesPanel) {
        objectivesPanel.classList.toggle('hidden', active);
    }
    updateGameModeLabel(active);
    if (!active) {
        showLevelInstructionsPanel(false);
        updateCampaignHighlights(null);
    }
}
window.setCampaignUIActive = setCampaignUIActive;

let container;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;
const panSpeed = 0.1;
let isDraggingNode = false;
let draggedNode = null;

export function initGame() {
    STATE.sound = new SoundService();

    container = document.getElementById('canvas-container');
    initScene(container);
    initInteractions();

    isPanning = false;
    lastMouseX = 0;
    lastMouseY = 0;
    isDraggingNode = false;
    draggedNode = null;

    resetCamera();

    setTimeout(() => {
        showMainMenu();
    }, 100);
}

function resetGame(mode = 'survival') {
    STATE.sound.init();
    STATE.sound.playGameBGM();
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
    STATE.internetNode.connections = [];
}

function restartGame() {
    document.getElementById('modal').classList.add('hidden');
    resetGame();
}
window.restartGame = restartGame;


function flashMoney() {
    const el = document.getElementById('money-display');
    el.classList.add('text-red-500');
    setTimeout(() => el.classList.remove('text-red-500'), 300);
}


window.startGame = (mode = GAME_MODES.SANDBOX) => {
    document.getElementById('main-menu-modal').classList.add('hidden');
    resetGame(mode === GAME_MODES.CAMPAIGN ? 'campaign' : 'survival');
};

window.startSandbox = () => {
    GameContext.mode = GAME_MODES.SANDBOX;
    setCampaignUIActive(false);
    setSandboxObjectivesPanel();
    setSandboxShop();
    GameContext.currentLevelId = null;
    setTrafficProfile(null);
    showLevelInstructionsPanel(false);
    showView('sandbox');
    window.setTool('select');  
    startGame(GAME_MODES.SANDBOX);
};

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
    STATE.services.forEach(s => {
        if (s && typeof s.destroy === 'function') s.destroy();
    });
    STATE.requests.forEach(r => {
        if (r && typeof r.destroy === 'function') r.destroy();
    });
    STATE.connections.forEach(link => {
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

    STATE.services = [];
    STATE.requests = [];
    STATE.connections = [];
    STATE.internetNode.connections = [];
}

function createService(type, pos) {
    const service = CONFIG.services[type];
    if (!service) return;
    if (STATE.money < CONFIG.services[type].cost) { flashMoney(); return; }
    if (STATE.services.find(s => s.position.distanceTo(pos) < 1)) return;
    STATE.money -= CONFIG.services[type].cost;
    STATE.services.push(new Service(type, pos));
    STATE.sound.playPlace();
}

function createConnection(fromId, toId) {
    if (fromId === toId) return;
    const getEntity = (id) => id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);
    const from = getEntity(fromId), to = getEntity(toId);
    if (!from || !to || from.connections.includes(toId)) return;

    // Relaxed connection rules: Allow any connection between distinct nodes
    // Removed hardcoded topology checks

    new Audio('assets/sounds/click-5.mp3').play();

    from.connections.push(toId);
    to.connections.push(fromId);
    const pts = [from.position.clone(), to.position.clone()];
    pts[0].y = pts[1].y = 1;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: CONFIG.colors.line });
    const line = new THREE.Line(geo, mat);
    connectionGroup.add(line);
    
    const linkId = 'link_' + Math.random().toString(36).substr(2, 9);
    STATE.connections.push({ id: linkId, from: fromId, to: toId, mesh: line });
    STATE.sound.playConnect();
}

function deleteLink(link) {
    if (!link) return;
    
    // Remove from source node's connections list
    const getEntity = (id) => id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);
    const fromNode = getEntity(link.from);
    if (fromNode) {
        fromNode.connections = fromNode.connections.filter(id => id !== link.to);
    }

    const toNode = getEntity(link.to);
    if (toNode) {
        toNode.connections = toNode.connections.filter(id => id !== link.from);
    }

    // Remove mesh
    connectionGroup.remove(link.mesh);
    link.mesh.geometry.dispose();
    link.mesh.material.dispose();

    // Remove from state
    STATE.connections = STATE.connections.filter(c => c.id !== link.id);
    STATE.sound.playDelete();
}

function deleteObject(id) {
    const svc = STATE.services.find(s => s.id === id);
    if (!svc) return;

    // Find all links connected to this node
    const linksToRemove = STATE.connections.filter(c => c.from === id || c.to === id);
    linksToRemove.forEach(link => deleteLink(link));

    svc.destroy();
    STATE.services = STATE.services.filter(s => s.id !== id);
    STATE.money += Math.floor(svc.config.cost / 2);
    STATE.sound.playDelete();
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

function getToolId(t) {
    const map = {
        'waf': 'tool-waf',
        'loadBalancer': 'tool-lb',
        'compute': 'tool-compute',
        'database': 'tool-db',
        'objectStorage': 'tool-objstore'
    };
    return map[t] || `tool-${t}`;
}

window.setTool = (t) => {
    STATE.activeTool = t; STATE.selectedNodeId = null;
    document.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(getToolId(t)).classList.add('active');
    new Audio('assets/sounds/click-9.mp3').play();
};

window.toggleMute = () => {
    const muted = STATE.sound.toggleMute();
    const icon = document.getElementById('mute-icon');
    const menuIcon = document.getElementById('menu-mute-icon');

    const iconText = muted ? '🔇' : '🔊';
    if (icon) icon.innerText = iconText;
    if (menuIcon) menuIcon.innerText = iconText;

    const muteBtn = document.getElementById('tool-mute');
    const menuMuteBtn = document.getElementById('menu-mute-btn'); // We need to add ID to menu button

    if (muted) {
        muteBtn.classList.add('bg-red-900');
        muteBtn.classList.add('pulse-green');
        if (menuMuteBtn) menuMuteBtn.classList.add('pulse-green');
    } else {
        muteBtn.classList.remove('bg-red-900');
        muteBtn.classList.remove('pulse-green');
        if (menuMuteBtn) menuMuteBtn.classList.remove('pulse-green');
    }
};

document.addEventListener('mousemove', (e) => {
    if (!renderer) return;

    if (isPanning) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
    
        // Adjust panning direction based on camera rotation
        // For isometric view (45 deg rotation), we need to rotate the input vector
        // But since we are using an orthographic camera with lookAt(0,0,0), simple X/Z panning relative to camera works best
        
        // Move camera opposite to mouse movement
        camera.position.x -= dx * panSpeed;
        camera.position.z -= dy * panSpeed;
        // Also move target to keep looking at same relative point if needed, 
        // but for Ortho camera looking at 0,0,0, moving position is enough if we don't re-lookAt every frame
        // However, resetCamera() calls lookAt. Let's just move position.
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        return;
    }

    if (isDraggingNode && draggedNode) {
        const i = getIntersect(e.clientX, e.clientY);
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        const target = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, target);
        
        const snapped = snapToGrid(target);
        draggedNode.position.copy(snapped);
        draggedNode.mesh.position.x = snapped.x;
        draggedNode.mesh.position.z = snapped.z;
        
        updateLinkVisuals(draggedNode.id);
        return;
    }

    if (e.target !== renderer.domElement) {
        document.getElementById('tooltip').style.display = 'none';
        STATE.hovered = null;
        return;
    }

    const i = getIntersect(e.clientX, e.clientY);
    STATE.hovered = i;

    // Tooltip logic
    const tooltip = document.getElementById('tooltip');
    if (i.type === 'service' || i.type === 'link') {
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.style.display = 'block';
    } else {
        tooltip.style.display = 'none';
    }
});

document.addEventListener('mousedown', (e) => {
    if (!renderer) return;

    if (e.target !== renderer.domElement) return;

    if (e.button === 2 || e.button === 1) { // Right or Middle click
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        container.style.cursor = 'move';
    }

    if (e.button === 0) { // Left mouse button
        const i = getIntersect(e.clientX, e.clientY);

        if (STATE.activeTool === 'select') {
            if (i.type === 'service') {
                isDraggingNode = true;
                draggedNode = STATE.services.find(s => s.id === i.id);
                container.style.cursor = 'grabbing';
                STATE.selectedNodeId = i.id;
            } else {
                STATE.selectedNodeId = null;
            }
        } else if (STATE.activeTool === 'delete') {
            if (i.type === 'service') deleteObject(i.id);
            else if (i.type === 'link') deleteLink(i.link);
        } else if (STATE.activeTool === 'connect') {
            if (i.type === 'service' || i.type === 'internet') {
                if (!STATE.selectedNodeId) {
                    STATE.selectedNodeId = i.id;
                    // Optional: Add visual feedback for source selection here
                } else {
                    createConnection(STATE.selectedNodeId, i.id);
                    STATE.selectedNodeId = null;
                }
            } else {
                STATE.selectedNodeId = null;
            }
        } else {
            // Placement tools
            if (i.type === 'ground') {
                createService(STATE.activeTool, snapToGrid(i.pos));
            }
        }
    }
});

document.addEventListener('mouseup', (e) => {
    if (!renderer) return;

    if (e.button === 0) { // Left mouse button
        isDraggingNode = false;
        draggedNode = null;
        container.style.cursor = 'auto';
    }
    
    if (e.button === 2 || e.button === 1) {
        isPanning = false;
        container.style.cursor = 'default';
    }
    
    if (isDraggingNode) {
        isDraggingNode = false;
        draggedNode = null;
        container.style.cursor = 'default';
    }
});

export function gameFrame(time) {
    const lastTime = STATE.lastTime ?? time;
    const delta = (time - lastTime) / 1000;
    STATE.lastTime = time;

    if (!STATE.isRunning) {
        if (!renderer) return;
        renderer.render(scene, camera);
        return;
    }

    gameTick(delta);

    // Update UI
    document.getElementById('rps-display').innerText = `${STATE.currentRPS.toFixed(1)} req/s`;
    document.getElementById('money-display').innerText = `$${STATE.money.toFixed(2)}`;

    const totalUpkeep = STATE.services.reduce((sum, s) => sum + (s.config.upkeep / 60), 0);
    document.getElementById('upkeep-display').innerText = `-$${totalUpkeep.toFixed(2)}/s`;
    
    updateTooltip();

    // Check game over
    if (STATE.reputation <= 0 || STATE.money <= -1000) {
        STATE.isRunning = false;
        document.getElementById('modal').classList.remove('hidden');
        document.getElementById('modal-title').innerText = STATE.reputation <= 0 ? 'REPUTATION LOST' : 'BANKRUPT';
        document.getElementById('modal-desc').innerText = STATE.reputation <= 0 ? 'Users have abandoned your platform.' : 'Funding has been cut.';
    }

    renderer.render(scene, camera);
}

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') {
        resetCamera();
    }
    if (e.key.toLowerCase() === 't') {
        toggleCameraMode();
    }
    if (e.key.toLowerCase() === 'h') {
        const ui = document.getElementById('statsPanel');
        ui.classList.toggle('hidden');
    }
});

// Prevent context menu on right click
document.addEventListener('contextmenu', event => event.preventDefault());