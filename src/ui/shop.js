import { LEVELS } from "../levels.js";
import { GameContext, applyToolbarWhitelist } from "../sim/economy.js";

const SHOP_DEFAULT_ORDER = ['modem', 'firewall', 'switch', 'waf', 'loadBalancer', 'compute', 'database', 'objectStorage'];
const CAMPAIGN_HUB_SHOP_ORDER = ['modem', 'firewall', 'waf'];
const CAMPAIGN_LEVEL_FALLBACK_SHOP = ['modem', 'waf'];

const SERVICE_SUBTITLES = {
    modem: 'Edge',
    firewall: 'Perimeter',
    switch: 'Aggregator',
    waf: 'Security',
    loadBalancer: 'Routing',
    compute: 'CPU',
    database: 'Persistence',
    objectStorage: 'Files'
};

const SERVICE_ICON = {
    modem: '⌂',
    firewall: '⛨',
    switch: '⇄',
    waf: '🛡️',
    loadBalancer: '⚙',
    compute: '☐',
    database: '◯',
    objectStorage: '⬡'
};

export function buildShopButton(type) {
    const service = CONFIG.services[type];
    if (!service) return null;
    const button = document.createElement('button');
    button.id = `tool-${type}`;
    button.dataset.toolId = type;
    button.dataset.toolName = service.name;
    button.className = 'service-btn bg-gray-800 text-gray-200 p-2 rounded-lg w-16 h-20 flex flex-col items-center justify-center border border-transparent relative transition hover:border-white/40';
    button.onclick = () => window.setTool(type);
    const icon = SERVICE_ICON[type] || type.charAt(0).toUpperCase();
    button.innerHTML = `
        <div class="absolute top-0 right-0 bg-green-900/80 text-green-400 text-[9px] px-1 rounded-bl font-mono">$${service.cost}</div>
        <div class="text-2xl leading-none">${icon}</div>
        <span class="text-[10px] font-bold mt-1 leading-tight">${service.name}</span>
        <span class="text-[8px] text-gray-400 leading-tight">${SERVICE_SUBTITLES[type] || 'Service'}</span>
    `;
    return button;
}

export function renderShopItems(serviceTypes = []) {
    const container = document.getElementById('shop-items');
    if (!container) return;
    container.innerHTML = '';
    serviceTypes.forEach(type => {
        const btn = buildShopButton(type);
        if (btn) container.appendChild(btn);
    });
}

export function setShopForServiceList(serviceList) {
    const uniqueList = Array.from(new Set(serviceList));
    renderShopItems(uniqueList);
    applyToolbarWhitelist(GameContext.toolbarWhitelist || []);
}

export function mapWhitelistToServices(list = []) {
    const normalized = new Set(list.map(item => typeof item === 'string' ? item.toLowerCase() : item));
    const services = [];
    SHOP_DEFAULT_ORDER.forEach(type => {
        if (normalized.has(type.toLowerCase())) services.push(type);
    });
    return services;
}

export function setSandboxShop() {
    GameContext.toolbarWhitelist = [];
    setShopForServiceList(SHOP_DEFAULT_ORDER);
}

export function setCampaignShop() {
    setShopForServiceList(CAMPAIGN_HUB_SHOP_ORDER);
}

export function setShopForLevel(levelId) {
    const level = LEVELS[levelId];
    const derived = level ? mapWhitelistToServices(level.toolbarWhitelist) : [];
    const list = derived.length ? derived : CAMPAIGN_LEVEL_FALLBACK_SHOP;
    setShopForServiceList(list);
}
