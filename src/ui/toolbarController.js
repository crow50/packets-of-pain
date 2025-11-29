import { GameContext } from "../sim/economy.js";

function normalizeToolbarList(list = []) {
    if (!Array.isArray(list)) return [];
    return list.map(item => typeof item === 'string' ? item.toLowerCase() : item);
}

export function applyToolbarWhitelist(list = []) {
    GameContext.toolbarWhitelist = list;
    const normalized = normalizeToolbarList(list);
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
