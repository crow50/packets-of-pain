STATE.sound = new SoundService();


const GAME_MODES = {
  SANDBOX: "sandbox",
  CAMPAIGN: "campaign",
};

let currentGameMode = null;


const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.bg);
scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.008);

const aspect = window.innerWidth / window.innerHeight;
const d = 50;
const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
const cameraTarget = new THREE.Vector3(0, 0, 0);
let isIsometric = true;

function resetCamera() {
    if (isIsometric) {
        camera.position.set(20, 20, 20);
        camera.lookAt(cameraTarget);
    } else {
        camera.position.set(0, 50, 0);
        camera.lookAt(cameraTarget);
    }
    camera.updateProjectionMatrix();
}

resetCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(CONFIG.gridSize * CONFIG.tileSize, CONFIG.gridSize, CONFIG.colors.grid, CONFIG.colors.grid);
scene.add(gridHelper);

const serviceGroup = new THREE.Group();
const connectionGroup = new THREE.Group();
const requestGroup = new THREE.Group();
scene.add(serviceGroup);
scene.add(connectionGroup);
scene.add(requestGroup);

const internetGeo = new THREE.BoxGeometry(6, 1, 10);
const internetMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x00ffff, emissiveIntensity: 0.2, roughness: 0.2 });
const internetMesh = new THREE.Mesh(internetGeo, internetMat);
internetMesh.position.copy(STATE.internetNode.position);
internetMesh.castShadow = true;
internetMesh.receiveShadow = true;
scene.add(internetMesh);
STATE.internetNode.mesh = internetMesh;


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;
const panSpeed = 0.1;

let isDraggingNode = false;
let draggedNode = null;

function updateLinkVisuals(nodeId) {
    const links = STATE.connections.filter(c => c.from === nodeId || c.to === nodeId);
    links.forEach(link => {
        const getEntity = (id) => id === 'internet' ? STATE.internetNode : STATE.services.find(s => s.id === id);
        const from = getEntity(link.from);
        const to = getEntity(link.to);
        
        if (from && to) {
            const positions = link.mesh.geometry.attributes.position.array;
            positions[0] = from.position.x;
            positions[1] = 1; // y is fixed
            positions[2] = from.position.z;
            positions[3] = to.position.x;
            positions[4] = 1;
            positions[5] = to.position.z;
            link.mesh.geometry.attributes.position.needsUpdate = true;
        }
    });
}

function resetGame(mode = 'survival') {
    STATE.sound.init();
    STATE.sound.playGameBGM();
    STATE.gameMode = mode;
    STATE.money = CONFIG.survival.startBudget;
    STATE.reputation = 100;
    STATE.requestsProcessed = 0;
    STATE.services = [];
    STATE.requests = [];
    STATE.connections = [];
    STATE.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
    STATE.isRunning = true;
    STATE.lastTime = performance.now();
    STATE.timeScale = 0;
    STATE.currentRPS = CONFIG.survival.baseRPS;
    STATE.spawnTimer = 0;
    STATE.hovered = null;

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

    // Reset UI
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-pause').classList.add('active');
    document.getElementById('btn-play').classList.add('pulse-green');

    // Update UI displays
    updateScoreUI();

    // Reset Reputation Bar
    const repBar = document.getElementById('rep-bar');
    if (repBar) {
        repBar.style.width = '100%';
        repBar.classList.remove('bg-red-500');
        repBar.classList.add('bg-yellow-500');
    }

    // Ensure loop is running
    if (!STATE.animationId) {
        animate(performance.now());
    }
}

function restartGame() {
    document.getElementById('modal').classList.add('hidden');
    resetGame();
}

// Initial setup - show menu, don't start game loop yet
setTimeout(() => {
    showMainMenu();
}, 100);


function getIntersect(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(serviceGroup.children, true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && obj.parent !== serviceGroup) obj = obj.parent;
        return { type: 'service', id: obj.userData.id, obj: obj };
    }

    // Check for links
    raycaster.params.Line.threshold = 1;
    const linkIntersects = raycaster.intersectObjects(connectionGroup.children, true);
    if (linkIntersects.length > 0) {
        const mesh = linkIntersects[0].object;
        const link = STATE.connections.find(c => c.mesh === mesh);
        if (link) return { type: 'link', id: link.id, obj: mesh, link: link };
    }

    const intInter = raycaster.intersectObject(STATE.internetNode.mesh);
    if (intInter.length > 0) return { type: 'internet', id: 'internet', obj: STATE.internetNode.mesh };

    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return { type: 'ground', pos: target };
}

function snapToGrid(vec) {
    const s = CONFIG.tileSize;
    return new THREE.Vector3(
        Math.round(vec.x / s) * s,
        0,
        Math.round(vec.z / s) * s
    );
}

function getTrafficType() {
    const r = Math.random();
    const dist = CONFIG.survival.trafficDistribution;
    if (r < dist[TRAFFIC_TYPES.WEB]) return TRAFFIC_TYPES.WEB;
    if (r < dist[TRAFFIC_TYPES.WEB] + dist[TRAFFIC_TYPES.API]) return TRAFFIC_TYPES.API;
    return TRAFFIC_TYPES.FRAUD;
}

function spawnRequest() {
    const type = getTrafficType();
    const req = new Request(type);
    STATE.requests.push(req);
    const conns = STATE.internetNode.connections;
    if (conns.length > 0) {
        const entryNodes = conns.map(id => STATE.services.find(s => s.id === id));
        const wafEntry = entryNodes.find(s => s?.type === 'waf');
        const target = wafEntry || entryNodes[Math.floor(Math.random() * entryNodes.length)];

        if (target) {
            req.lastNodeId = 'internet';
            req.flyTo(target);
        } else failRequest(req);
    } else failRequest(req);
}

function updateScore(req, outcome) {
    const points = CONFIG.survival.SCORE_POINTS;

    if (outcome === 'FRAUD_BLOCKED') {
        STATE.score.fraudBlocked += points.FRAUD_BLOCKED_SCORE;
        STATE.score.total += points.FRAUD_BLOCKED_SCORE;
        STATE.reputation += 1; // Reward for blocking fraud
        STATE.sound.playFraudBlocked();
    } else if (req.type === TRAFFIC_TYPES.FRAUD && outcome === 'FRAUD_PASSED') {
        STATE.reputation += points.FRAUD_PASSED_REPUTATION;
        console.warn(`FRAUD PASSED: ${points.FRAUD_PASSED_REPUTATION} Rep. (Critical Failure)`);
    } else if (outcome === 'COMPLETED') {
        if (req.type === TRAFFIC_TYPES.WEB) {
            STATE.score.web += points.WEB_SCORE;
            STATE.score.total += points.WEB_SCORE;
            STATE.money += points.WEB_REWARD;
            STATE.reputation += 0.1; // Small rep gain for success
        } else if (req.type === TRAFFIC_TYPES.API) {
            STATE.score.api += points.API_SCORE;
            STATE.score.total += points.API_SCORE;
            STATE.money += points.API_REWARD;
            STATE.reputation += 0.1; // Small rep gain for success
        }
    } else if (outcome === 'FAILED') {
        STATE.reputation += points.FAIL_REPUTATION;
        STATE.score.total -= (req.type === TRAFFIC_TYPES.API ? points.API_SCORE : points.WEB_SCORE) / 2;
    }

    // Cap reputation at 100
    if (STATE.reputation > 100) STATE.reputation = 100;

    // Update Reputation Bar
    const repBar = document.getElementById('rep-bar');
    if (repBar) {
        repBar.style.width = `${Math.max(0, STATE.reputation)}%`;
        if (STATE.reputation < 30) repBar.classList.replace('bg-yellow-500', 'bg-red-500');
        else repBar.classList.replace('bg-red-500', 'bg-yellow-500');
    }

    updateScoreUI();
}

function finishRequest(req) {
    STATE.requestsProcessed++;
    updateScore(req, 'COMPLETED');
    removeRequest(req);
}

function failRequest(req) {
    const failType = req.type === TRAFFIC_TYPES.FRAUD ? 'FRAUD_PASSED' : 'FAILED';
    updateScore(req, failType);
    STATE.sound.playFail();
    req.mesh.material.color.setHex(CONFIG.colors.requestFail);
    setTimeout(() => removeRequest(req), 500);
}

function removeRequest(req) {
    req.destroy();
    STATE.requests = STATE.requests.filter(r => r !== req);
}

function updateScoreUI() {
    document.getElementById('total-score-display').innerText = STATE.score.total;
    document.getElementById('score-web').innerText = STATE.score.web;
    document.getElementById('score-api').innerText = STATE.score.api;
    document.getElementById('score-fraud').innerText = STATE.score.fraudBlocked;
}

function flashMoney() {
    const el = document.getElementById('money-display');
    el.classList.add('text-red-500');
    setTimeout(() => el.classList.remove('text-red-500'), 300);
}

function showMainMenu() {
    // Ensure sound is initialized if possible (browsers might block until interaction)
    if (!STATE.sound.ctx) STATE.sound.init();
    STATE.sound.playMenuBGM();

    document.getElementById('main-menu-modal').classList.remove('hidden');
    document.getElementById('faq-modal').classList.add('hidden');
    document.getElementById('modal').classList.add('hidden');
}

let faqSource = 'menu'; // 'menu' or 'game'

window.showFAQ = (source = 'menu') => {
    faqSource = source;
    // If called from button (onclick="showFAQ()"), it defaults to 'menu' effectively unless we change the HTML.
    // But wait, the button in index.html just calls showFAQ(). 
    // We can check if main menu is visible.

    if (!document.getElementById('main-menu-modal').classList.contains('hidden')) {
        faqSource = 'menu';
        document.getElementById('main-menu-modal').classList.add('hidden');
    } else {
        faqSource = 'game';
    }

    document.getElementById('faq-modal').classList.remove('hidden');
};

window.closeFAQ = () => {
    document.getElementById('faq-modal').classList.add('hidden');
    if (faqSource === 'menu') {
        document.getElementById('main-menu-modal').classList.remove('hidden');
    }
};

window.startGame = () => {
    document.getElementById('main-menu-modal').classList.add('hidden');
    resetGame();
};

window.startSandbox = () => {
    currentGameMode = GAME_MODES.SANDBOX;
    startGame();
};

window.startCampaign = () => {
    alert("Campaign mode is not implemented yet.");
};

function createService(type, pos) {
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
    if (load <= 0.5) return 0;
    return 2 * (load - 0.5);
}

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

window.setTimeScale = (s) => {
    STATE.timeScale = s;
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));

    if (s === 0) {
        document.getElementById('btn-pause').classList.add('active');
        document.getElementById('btn-play').classList.add('pulse-green');
    } else if (s === 1) {
        document.getElementById('btn-play').classList.add('active');
        document.getElementById('btn-play').classList.remove('pulse-green');
    } else if (s === 3) {
        document.getElementById('btn-fast').classList.add('active');
        document.getElementById('btn-play').classList.remove('pulse-green');
    }
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

function updateTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (!STATE.hovered || tooltip.style.display === 'none') return;

    const i = STATE.hovered;
    if (i.type === 'service' || i.type === 'link') {
        const id = i.id;
        let content = `<div class="font-bold border-b border-gray-500 pb-1 mb-1 text-xs">${id}</div>`;

        if (i.type === 'service') {
            const svc = STATE.services.find(s => s.id === id);
            if (svc) {
                const loadPct = Math.round(svc.totalLoad * 100);
                const loadColor = loadPct > 80 ? 'text-red-400' : (loadPct > 50 ? 'text-yellow-400' : 'text-green-400');
                
                content += `
                    <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                        <span class="text-gray-400">Type:</span> <span class="text-white capitalize">${svc.type}</span>
                        <span class="text-gray-400">Tier:</span> <span class="text-white">${svc.tier || 1}</span>
                        <span class="text-gray-400">Load:</span> <span class="${loadColor}">${loadPct}%</span>
                        <span class="text-gray-400">Queue:</span> <span class="text-white">${svc.queue.length}/20</span>
                        <span class="text-gray-400">Proc:</span> <span class="text-white">${svc.processing.length}/${svc.config.capacity}</span>
                        <span class="text-gray-400">Links:</span> <span class="text-white">${svc.connections.length}</span>
                    </div>
                `;
            }
        } else if (i.type === 'link') {
            const link = i.link;
            // Calculate traffic on this link
            const traffic = STATE.requests.filter(r => 
                r.isMoving && r.target && (
                    (r.lastNodeId === link.from && r.target.id === link.to) ||
                    (r.lastNodeId === link.to && r.target.id === link.from)
                )
            ).length;

            content += `
                <div class="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
                    <span class="text-gray-400">Type:</span> <span class="text-white">Wired</span>
                    <span class="text-gray-400">Traffic:</span> <span class="text-white">${traffic} pkts</span>
                </div>
            `;
        }

        tooltip.innerHTML = content;
    }
}

document.addEventListener('mousedown', (e) => {
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

function animate(time) {
    STATE.animationId = requestAnimationFrame(animate);

    const delta = (time - STATE.lastTime) / 1000;
    STATE.lastTime = time;

    if (!STATE.isRunning) {
        renderer.render(scene, camera);
        return;
    }

    // Spawn requests
    STATE.spawnTimer += delta * STATE.timeScale;
    if (STATE.spawnTimer > 1 / STATE.currentRPS) {
        spawnRequest();
        STATE.spawnTimer = 0;
    }

    // Difficulty Ramp
    if (STATE.gameMode === 'survival') {
        STATE.currentRPS += CONFIG.survival.rampUp * delta * STATE.timeScale;
    }

    // Update entities
    STATE.services.forEach(s => s.update(delta * STATE.timeScale));
    STATE.requests.forEach(r => r.update(delta * STATE.timeScale));

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

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') {
        resetCamera();
    }
    if (e.key.toLowerCase() === 't') {
        isIsometric = !isIsometric;
        resetCamera();
    }
    if (e.key.toLowerCase() === 'h') {
        const ui = document.getElementById('statsPanel');
        ui.classList.toggle('hidden');
    }
});

// Prevent context menu on right click
document.addEventListener('contextmenu', event => event.preventDefault());