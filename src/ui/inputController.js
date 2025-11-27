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

const PAN_SPEED = 0.1;

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
            STATE.hovered = null;
            return;
        }

        const intersect = getIntersect(e.clientX, e.clientY);
        STATE.hovered = intersect;

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

            if (STATE.activeTool === 'select') {
                if (intersect.type === 'service') {
                    isDraggingNode = true;
                    draggedNode = STATE.services.find(s => s.id === intersect.id);
                    container.style.cursor = 'grabbing';
                    STATE.selectedNodeId = intersect.id;
                } else {
                    STATE.selectedNodeId = null;
                }
            } else if (STATE.activeTool === 'delete') {
                if (intersect.type === 'service') deleteObject(intersect.id);
                else if (intersect.type === 'link') deleteLink(intersect.link);
            } else if (STATE.activeTool === 'connect') {
                if (intersect.type === 'service' || intersect.type === 'internet') {
                    if (!STATE.selectedNodeId) {
                        STATE.selectedNodeId = intersect.id;
                    } else {
                        createConnection(STATE.selectedNodeId, intersect.id);
                        STATE.selectedNodeId = null;
                    }
                } else {
                    STATE.selectedNodeId = null;
                }
            } else if (intersect.type === 'ground') {
                createService(STATE.activeTool, snapToGrid(intersect.pos));
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

    function onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (key === 'r') {
            resetCamera();
        } else if (key === 't') {
            toggleCameraMode();
        } else if (key === 'h') {
            const panel = document.getElementById('statsPanel');
            panel?.classList.toggle('hidden');
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
