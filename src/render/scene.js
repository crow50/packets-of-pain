export let scene;
export let camera;
export let renderer;
export let serviceGroup;
export let connectionGroup;
export let requestGroup;
export let internetMesh;

const d = 50;
let cameraTarget = new THREE.Vector3(0, 0, 0);
let isIsometric = true;
let resizeHandlerAttached = false;

function handleResize() {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function attachResizeHandler() {
    if (resizeHandlerAttached) return;
    window.addEventListener('resize', handleResize);
    resizeHandlerAttached = true;
}

function detachResizeHandler() {
    if (!resizeHandlerAttached) return;
    window.removeEventListener('resize', handleResize);
    resizeHandlerAttached = false;
}

export function initScene(containerEl) {
    if (!containerEl) {
        throw new Error('Container element required to initialize the scene.');
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.008);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    cameraTarget = new THREE.Vector3(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerEl.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(
        CONFIG.gridSize * CONFIG.tileSize,
        CONFIG.gridSize,
        CONFIG.colors.grid,
        CONFIG.colors.grid
    );
    scene.add(gridHelper);

    serviceGroup = new THREE.Group();
    connectionGroup = new THREE.Group();
    requestGroup = new THREE.Group();
    scene.add(serviceGroup);
    scene.add(connectionGroup);
    scene.add(requestGroup);

    window.serviceGroup = serviceGroup;
    window.connectionGroup = connectionGroup;
    window.requestGroup = requestGroup;

    const internetGeo = new THREE.BoxGeometry(6, 1, 10);
    const internetMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0x00ffff,
        emissiveIntensity: 0.2,
        roughness: 0.2
    });
    internetMesh = new THREE.Mesh(internetGeo, internetMat);
    internetMesh.position.copy(STATE.internetNode.position);
    internetMesh.castShadow = true;
    internetMesh.receiveShadow = true;
    scene.add(internetMesh);
    STATE.internetNode.mesh = internetMesh;

    handleResize();
    attachResizeHandler();
}

export function resetCamera() {
    if (!camera) return;
    if (isIsometric) {
        camera.position.set(20, 20, 20);
    } else {
        camera.position.set(0, 50, 0);
    }
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
}

export function toggleCameraMode() {
    isIsometric = !isIsometric;
    resetCamera();
}

function disposeObject(obj) {
    if (!obj) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat?.dispose());
        } else if (typeof obj.material.dispose === 'function') {
            obj.material.dispose();
        }
    }
}

function disposeGroup(group) {
    if (!group) return;
    group.traverse(child => disposeObject(child));
    if (scene) scene.remove(group);
}

export function disposeScene() {
    detachResizeHandler();

    disposeGroup(serviceGroup);
    disposeGroup(connectionGroup);
    disposeGroup(requestGroup);
    disposeObject(internetMesh);

    if (scene && internetMesh) {
        scene.remove(internetMesh);
    }

    if (renderer) {
        if (typeof renderer.dispose === 'function') {
            renderer.dispose();
        }
        const canvas = renderer.domElement;
        if (canvas?.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }

    scene = undefined;
    camera = undefined;
    renderer = undefined;
    serviceGroup = undefined;
    connectionGroup = undefined;
    requestGroup = undefined;
    internetMesh = undefined;
    STATE.internetNode.mesh = undefined;

    window.serviceGroup = undefined;
    window.connectionGroup = undefined;
    window.requestGroup = undefined;
}
