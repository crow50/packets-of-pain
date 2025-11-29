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
import { copyPosition } from "../sim/vectorUtils.js";
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
    if ('linkSourceId' in partial) engine.setLinkSource(partial.linkSourceId);
}

function positionTooltipAtNode(tooltip, serviceId) {
    if (!tooltip || !camera) return;
    const engine = getEngine();
    const services = engine?.getSimulation()?.services || [];
    const svc = services.find(s => s.id === serviceId);
    if (!svc || !svc.position) return;

    // Convert world position to screen coordinates
    const worldPos = new THREE.Vector3(svc.position.x, svc.position.y || 0, svc.position.z);
    const screenPos = worldPos.clone().project(camera);
    
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
    
    tooltip.style.left = `${x + 15}px`;
    tooltip.style.top = `${y + 15}px`;
    tooltip.style.display = 'block';
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
            copyPosition(draggedNode.position, snapped);
            updateLinkVisuals(draggedNode.id);
            
            // Update tooltip position during drag if this is the selected node
            const selectedNodeId = getEngine()?.getUIState()?.selectedNodeId;
            if (selectedNodeId === draggedNode.id) {
                const tooltip = document.getElementById('tooltip');
                if (tooltip) {
                    positionTooltipAtNode(tooltip, draggedNode.id);
                }
            }
            return;
        }

        // Allow interactions with tooltip without hiding it
        const tooltip = document.getElementById('tooltip');
        const isCanvas = e.target === renderer.domElement;
        const isTooltip = tooltip && (e.target === tooltip || tooltip.contains(e.target));
        const selectedNodeId = getEngine()?.getUIState()?.selectedNodeId;
        if (!isCanvas && !isTooltip && !selectedNodeId) {
            if (tooltip) tooltip.style.display = 'none';
            updateUIState({ hovered: null });
            return;
        }

        const intersect = getIntersect(e.clientX, e.clientY);
        updateUIState({ hovered: intersect });

        // Re-fetch tooltip element
        const tooltip2 = document.getElementById('tooltip');
        if (!tooltip2) return;
        
        // If a node is selected, pin tooltip to that node
        const selectedNodeId2 = getEngine()?.getUIState()?.selectedNodeId;
        if (selectedNodeId2) {
            positionTooltipAtNode(tooltip2, selectedNodeId2);
            return;
        }
        
        // Otherwise, follow hover behavior
        if (!intersect) return;
        if (intersect.type === 'service' || intersect.type === 'link' || intersect.type === 'internet') {
            tooltip2.style.left = `${e.clientX + 15}px`;
            tooltip2.style.top = `${e.clientY + 15}px`;
            tooltip2.style.display = 'block';
        } else {
            tooltip2.style.display = 'none';
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
            const linkSourceId = engine?.getUIState()?.linkSourceId;

            if (activeTool === 'select') {
                if (intersect.type === 'service') {
                    // Begin drag, but also persist tooltip visibility on selection
                    isDraggingNode = true;
                    draggedNode = services.find(s => s.id === intersect.id);
                    container.style.cursor = 'grabbing';
                    updateUIState({ selectedNodeId: intersect.id });
                    // Set hovered to this service so tooltip stays visible
                    updateUIState({ hovered: intersect });
                    const tooltip = document.getElementById('tooltip');
                    if (tooltip) {
                        positionTooltipAtNode(tooltip, intersect.id);
                    }
                } else {
                    updateUIState({ selectedNodeId: null });
                }
            } else if (activeTool === 'delete') {
                if (intersect.type === 'service') deleteObject(intersect.id);
                else if (intersect.type === 'link') deleteLink(intersect.link);
            } else if (activeTool === 'connect') {
                if (intersect.type === 'service' || intersect.type === 'internet') {
                    if (!linkSourceId) {
                        // First click: set link source
                        updateUIState({ linkSourceId: intersect.id });
                    } else {
                        // Second click: create connection and clear
                        createConnection(linkSourceId, intersect.id);
                        updateUIState({ linkSourceId: null });
                    }
                } else {
                    // Clicked elsewhere: cancel linking
                    updateUIState({ linkSourceId: null });
                }
            } else if (intersect.type === 'service') {
                // Check if clicking on upgradeable service with matching tool
                const service = services.find(s => s.id === intersect.id);
                if (service && service.type === activeTool) {
                    // Attempt upgrade
                    engine?.upgradeService(intersect.id);
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
                'hud-top-row',
                'hud-right-column',
                'bottom-toolbar'
            ];
            
            // Mode-specific panels (only toggle if they were visible)
            const modeSpecificPanels = [
                'campaign-panel',         // Campaign mode only (unified panel)
                'sandbox-panel'           // Sandbox mode only
            ];
            
            // Panels that have their own visibility logic (campaign-specific)
            
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
