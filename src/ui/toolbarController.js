function normalizeToolbarList(list = []) {
    if (!Array.isArray(list)) return [];
    return list.map(item => typeof item === 'string' ? item.toLowerCase() : item);
}

// Helper to get engine reference
function getEngine() {
    return window.__POP_RUNTIME__?.current?.engine;
}

let currentWhitelist = [];

const TOOL_BUTTON_SELECTOR = '[data-tool-id]';
const LINK_DIRECTION_TOGGLE_ID = 'link-direction-toggle';

function handleToolbarButtonClick(event) {
    const button = event.currentTarget;
    if (!button || button.disabled) return;
    const toolId = button.dataset.toolId;
    if (!toolId) return;
    window.setTool?.(toolId);
}

function bindToolbarButtons() {
    document.querySelectorAll(TOOL_BUTTON_SELECTOR).forEach(button => {
        button.addEventListener('click', handleToolbarButtonClick);
    });
}

function applyDirectionToggleState(button, enabled) {
    if (!button) return;
    button.dataset.bidirectional = enabled ? 'true' : 'false';
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? '↔ Bidirectional' : '→ One-Way';
    button.classList.toggle('bg-blue-900/40', enabled);
    button.classList.toggle('text-blue-200', enabled);
    button.classList.toggle('border-blue-500', enabled);
    button.classList.toggle('bg-gray-800/60', !enabled);
    button.classList.toggle('text-gray-300', !enabled);
    button.classList.toggle('border-gray-600', !enabled);
}

function initDirectionToggle() {
    const button = document.getElementById(LINK_DIRECTION_TOGGLE_ID);
    if (!button) return;
    const resolveState = () => getEngine()?.getUIState()?.linkBidirectional !== false;
    const syncFromEngine = () => applyDirectionToggleState(button, resolveState());

    let awaitingEngine = true;
    let lastEngine = null;
    const refreshEngineState = () => {
        const engine = getEngine();
        if (engine !== lastEngine) {
            lastEngine = engine || null;
            if (engine) {
                awaitingEngine = false;
                button.removeAttribute('data-waiting-engine');
                syncFromEngine();
            } else {
                awaitingEngine = true;
                button.dataset.waitingEngine = 'true';
            }
        } else if (!engine && !awaitingEngine) {
            awaitingEngine = true;
            button.dataset.waitingEngine = 'true';
        }
    };

    button.dataset.waitingEngine = 'true';
    refreshEngineState();
    setInterval(refreshEngineState, 300);

    button.addEventListener('click', () => {
        if (awaitingEngine) return;
        const engine = getEngine();
        if (!engine) return;
        const next = !resolveState();
        engine.setLinkBidirectional?.(next);
        applyDirectionToggleState(button, next);
    });
}

export function applyToolbarWhitelist(list = []) {
    currentWhitelist = Array.isArray(list) ? [...list] : [];
    getEngine()?.setToolbarWhitelist(currentWhitelist);
    const normalized = normalizeToolbarList(currentWhitelist);
    const allowedToolIds = new Set();

    document.querySelectorAll('[data-tool-name]').forEach(btn => {
        const name = btn.dataset.toolName ? btn.dataset.toolName.toLowerCase() : '';
        const id = btn.dataset.toolId ? btn.dataset.toolId.toLowerCase() : '';
        const allowed = normalized.length === 0 || normalized.includes(name) || normalized.includes(id);
        if (allowed && btn.dataset.toolId) {
            allowedToolIds.add(btn.dataset.toolId);
        }
        btn.disabled = !allowed;
        btn.classList.toggle('opacity-40', !allowed);
    });

    if (normalized.length === 0) return;
    const currentTool = window.__POP_RUNTIME__?.current?.engine?.getUIState()?.activeTool?.toLowerCase?.();
    const currentAllowed = currentTool ? allowedToolIds.has(currentTool) : false;
    if (currentAllowed) return;

    let fallbackTool = null;
    if (allowedToolIds.has('select')) {
        fallbackTool = 'select';
    } else {
        const iterator = allowedToolIds.values().next();
        fallbackTool = iterator?.value || 'select';
    }
    if (fallbackTool && typeof window.setTool === 'function') {
        window.setTool(fallbackTool);
    }
}

window.applyToolbarWhitelist = applyToolbarWhitelist;

export function getCurrentToolbarWhitelist() {
    return [...currentWhitelist];
}

export function initToolbarController() {
    bindToolbarButtons();
    initDirectionToggle();
}
