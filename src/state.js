// Legacy STATE object - DEPRECATED
// All state now lives in the Engine (window.__POP_RUNTIME__.current.engine)
// This file is kept only for backwards compatibility during transition
// Access state via: engine.getSimulation() and engine.getUIState()

const STATE = {
    // Minimal stub - engine is now the source of truth
    get services() {
        return window.__POP_RUNTIME__?.current?.engine?.getSimulation()?.services || [];
    },
    get requests() {
        return window.__POP_RUNTIME__?.current?.engine?.getSimulation()?.requests || [];
    },
    get connections() {
        return window.__POP_RUNTIME__?.current?.engine?.getSimulation()?.connections || [];
    },
    get internetNode() {
        return window.__POP_RUNTIME__?.current?.engine?.getSimulation()?.internetNode || {
            id: 'internet',
            type: 'internet',
            position: new THREE.Vector3(-40, 0, 0),
            connections: []
        };
    },
    get money() {
        return window.__POP_RUNTIME__?.current?.engine?.getSimulation()?.money || 0;
    },
    get sound() {
        return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.sound || null;
    },
    get timeScale() {
        return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.timeScale || 1;
    },
    get activeTool() {
        return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.activeTool || 'select';
    },
    get selectedNodeId() {
        return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.selectedNodeId || null;
    },
    get hovered() {
        return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.hovered || null;
    }
};
