import { GameContext } from "../sim/economy.js";

function normalizeToolbarList(list = []) {
    if (!Array.isArray(list)) return [];
    return list.map(item => typeof item === 'string' ? item.toLowerCase() : item);
}

export function applyToolbarWhitelist(list = []) {
    GameContext.toolbarWhitelist = list;
    const normalized = normalizeToolbarList(list);

    document.querySelectorAll('[data-tool-name]').forEach(btn => {
        const name = btn.dataset.toolName ? btn.dataset.toolName.toLowerCase() : '';
        const id = btn.dataset.toolId ? btn.dataset.toolId.toLowerCase() : '';
        const allowed = normalized.length === 0 || normalized.includes(name) || normalized.includes(id);
        btn.disabled = !allowed;
        btn.classList.toggle('opacity-40', !allowed);
    });
}

window.applyToolbarWhitelist = applyToolbarWhitelist;
