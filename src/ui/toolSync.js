let engineRef = null;
let unsubscribe = null;

function highlightTool(toolName) {
    if (!toolName) toolName = 'select';
    document.querySelectorAll('[data-tool-id]').forEach(btn => {
        const id = btn.dataset.toolId;
        btn.classList.toggle('active', id === toolName);
    });
}

function handleToolChanged(payload) {
    if (!payload) return;
    highlightTool(payload.toolName);
}

export function initToolSync(engine) {
    engineRef = engine;
    const currentTool = engine?.getUIState()?.activeTool || 'select';
    highlightTool(currentTool);
    const unlisten = engine?.on('toolChanged', handleToolChanged);
    if (typeof unlisten === 'function') {
        unsubscribe = unlisten;
    }
}

export function disposeToolSync() {
    if (typeof unsubscribe === 'function') {
        unsubscribe();
    }
    unsubscribe = null;
    engineRef = null;
}
