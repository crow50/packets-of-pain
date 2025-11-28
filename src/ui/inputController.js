import { renderer, camera } from "../render/scene.js";
import {
    getIntersect,
    snapToGrid,
    updateLinkVisuals,
    raycaster,
    mouse,
    plane
} from "../render/interactions.js";
import {
    createService,
    createConnection,
    deleteLink,
    deleteObject
} from "../sim/tools.js";
import { resetCamera, toggleCameraMode } from "../render/scene.js";
import { setHudHidden } from "./hudController.js";

// Module-level engine reference, set via init()
let _engine = null;

/**
 * Initialize input controller module with engine reference
 * @param {object} engine - The game engine instance
 */
export function init(engine) {
    _engine = engine;
}

// Fallback for backwards compatibility during transition
function getEngine() {
    return _engine || window.__POP_RUNTIME__?.current?.engine;
}

const PAN_SPEED = 0.1;

function updateUIState(partial) {
    const engine = getEngine();
    if (!engine) return;
    if ('hovered' in partial) engine.setHovered(partial.hovered);
    if ('selectedNodeId' in partial) engine.setSelectedNode(partial.selectedNodeId);
}

export function createInputController({ container }) {
    if (!container) {
        throw new Error("Input controller requires a container element");
    }

    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isDraggingNode = false;
    let draggedNode = null;

    const listeners = [];

    function addListener(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        listeners.push({ target, type, handler, options });
    }

    function onMouseMove(e) {
        if (!renderer || !camera) return;

        if (isPanning) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            camera.position.x -= dx * PAN_SPEED;
            camera.position.z -= dy * PAN_SPEED;
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
            const tooltip = document.getElementById('tooltip');
            if (tooltip) tooltip.style.display = 'none';
            updateUIState({ hovered: null });
            return;
        }

        const intersect = getIntersect(e.clientX, e.clientY);
        updateUIState({ hovered: intersect });

        const tooltip = document.getElementById('tooltip');
        if (!tooltip || !intersect) return;

        if (intersect.type === 'service' || intersect.type === 'link') {
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;
            tooltip.style.display = 'block';
        } else {
            tooltip.style.display = 'none';
        }
    }

    function onMouseDown(e) {
        if (!renderer) return;
        if (e.target !== renderer.domElement) return;

        if (e.button === 2 || e.button === 1) {
            isPanning = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            container.style.cursor = 'move';
        }

        if (e.button === 0) {
            const intersect = getIntersect(e.clientX, e.clientY);
            if (!intersect) return;

            const engine = getEngine();
            const activeTool = engine?.getUIState()?.activeTool || 'select';
            const services = engine?.getSimulation()?.services || [];
            const selectedNodeId = engine?.getUIState()?.selectedNodeId;

            if (activeTool === 'select') {
                if (intersect.type === 'service') {
                    isDraggingNode = true;
                    draggedNode = services.find(s => s.id === intersect.id);
                    container.style.cursor = 'grabbing';
                    updateUIState({ selectedNodeId: intersect.id });
                } else {
                    updateUIState({ selectedNodeId: null });
                }
            } else if (activeTool === 'delete') {
                if (intersect.type === 'service') deleteObject(intersect.id);
                else if (intersect.type === 'link') deleteLink(intersect.link);
            } else if (activeTool === 'connect') {
                if (intersect.type === 'service' || intersect.type === 'internet') {
                    if (!selectedNodeId) {
                        updateUIState({ selectedNodeId: intersect.id });
                    } else {
                        createConnection(selectedNodeId, intersect.id);
                        updateUIState({ selectedNodeId: null });
                    }
                } else {
                    updateUIState({ selectedNodeId: null });
                }
            } else if (intersect.type === 'ground') {
                createService(activeTool, snapToGrid(intersect.pos));
            }
        }
    }

    function onMouseUp(e) {
        if (!renderer) return;

        if (e.button === 0) {
            isDraggingNode = false;
            draggedNode = null;
            container.style.cursor = 'auto';
        }
        if (e.button === 2 || e.button === 1) {
            isPanning = false;
            container.style.cursor = 'default';
        }
    }

    let hudHidden = false;
    
    function onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (key === 'r') {
            resetCamera();
        } else if (key === 't') {
            toggleCameraMode();
        } else if (key === 'h') {
            // Toggle HUD visibility state
            hudHidden = !hudHidden;
            
            // Notify hudController so it respects this in per-frame updates
            setHudHidden(hudHidden);
            
            // Panels that should be shown when HUD is visible
            const normalPanels = [
                'statsPanel',
                'detailsPanel', 
                'time-control-panel',
                'bottom-toolbar',
                'topology-warnings-panel'
            ];
            
            // Mode-specific panels (only toggle if they were visible)
            const modeSpecificPanels = [
                'objectivesPanel',        // Campaign mode only
                'sandbox-controls-panel'  // Sandbox mode only
            ];
            
            // Panels that have their own visibility logic (campaign-specific)
            // Don't touch level-instructions-panel - it's managed by campaign mode
            
            normalPanels.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) {
                    if (hudHidden) {
                        panel.classList.add('hidden');
                    } else {
                        panel.classList.remove('hidden');
                    }
                }
            });
            
            // For mode-specific panels, track their visibility state
            modeSpecificPanels.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) {
                    if (hudHidden) {
                        // Store visibility state before hiding
                        panel.dataset.wasVisible = !panel.classList.contains('hidden');
                        panel.classList.add('hidden');
                    } else {
                        // Restore only if it was visible before
                        if (panel.dataset.wasVisible === 'true') {
                            panel.classList.remove('hidden');
                        }
                    }
                }
            });
        }
    }

    addListener(document, 'mousemove', onMouseMove);
    addListener(document, 'mousedown', onMouseDown);
    addListener(document, 'mouseup', onMouseUp);
    addListener(document, 'keydown', onKeyDown);
    addListener(document, 'contextmenu', (evt) => evt.preventDefault());

    return {
        detach() {
            listeners.forEach(({ target, type, handler, options }) => {
                target.removeEventListener(type, handler, options);
            });
            listeners.length = 0;
            container.style.cursor = 'default';
            isPanning = false;
            isDraggingNode = false;
            draggedNode = null;
        }
    };
}
