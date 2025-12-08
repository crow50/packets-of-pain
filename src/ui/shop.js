import { getLevelById } from "../config/campaign/index.js";
import { applyToolbarWhitelist, getCurrentToolbarWhitelist } from "./toolbarController.js";
import { loadIcon } from "../services/AssetService.js";
import { getServiceDef, SHOP_ORDER } from "../config/serviceCatalog.js";
import { setTool } from "../sim/tools.js";

const SHOP_DEFAULT_ORDER = SHOP_ORDER;
const CAMPAIGN_HUB_SHOP_ORDER = ['MODEM', 'FIREWALL'];
const CAMPAIGN_LEVEL_FALLBACK_SHOP = ['MODEM'];

export function buildShopButton(type) {
    // Use service catalog as single source of truth
    const catalogEntry = getServiceDef(type);
    if (!catalogEntry || catalogEntry.drawable === false) return null;
    
    // Get display properties from catalog
    const displayName = catalogEntry.label;
    const cost = catalogEntry.baseCost;
    const subtitle = catalogEntry.subtitle;
    const emojiFallback = catalogEntry.icon;
    
    const button = document.createElement('button');
    button.id = `tool-${type}`;
    button.dataset.toolId = type;
    button.dataset.toolName = displayName;
    button.className = 'service-btn bg-gray-800 text-gray-200 p-2 rounded-lg w-16 h-20 flex flex-col items-center justify-center border border-transparent relative transition hover:border-white/40';
    button.onclick = () => setTool(type);
    
    // Create icon container with loading placeholder
    const iconContainer = document.createElement('div');
    iconContainer.className = 'text-2xl leading-none icon-container';
    iconContainer.textContent = emojiFallback; // Show emoji initially
    
    button.innerHTML = `
        <div class="absolute top-0 right-0 bg-green-900/80 text-green-400 text-[9px] px-1 rounded-bl font-mono">$${cost}</div>
    `;
    button.appendChild(iconContainer);
    
    // Add text labels
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-[10px] font-bold mt-1 leading-tight';
    nameSpan.textContent = displayName;
    button.appendChild(nameSpan);
    
    const subtitleSpan = document.createElement('span');
    subtitleSpan.className = 'text-[8px] text-gray-400 leading-tight';
    subtitleSpan.textContent = subtitle;
    button.appendChild(subtitleSpan);
    
    // Async load SVG icon if available
    loadIcon(type, catalogEntry).then(result => {
        if (result.type === 'svg') {
            // Replace emoji with SVG image
            const img = document.createElement('img');
            img.src = result.src;
            img.alt = displayName;
            img.className = 'w-8 h-8 object-contain';
            img.onerror = () => {
                // Fallback to emoji on load error
                iconContainer.textContent = emojiFallback;
            };
            iconContainer.textContent = '';
            iconContainer.appendChild(img);
        }
        // If type is 'emoji', keep the existing emoji text
    }).catch(() => {
        // Keep emoji on any error
    });
    
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
    applyToolbarWhitelist(getCurrentToolbarWhitelist());
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
    applyToolbarWhitelist([]);
    setShopForServiceList(SHOP_DEFAULT_ORDER);
}

export function setCampaignShop() {
    setShopForServiceList(CAMPAIGN_HUB_SHOP_ORDER);
}

export function setShopForLevel(levelId) {
    const level = getLevelById(levelId);
    const derived = level ? mapWhitelistToServices(level.toolbarWhitelist) : [];
    const list = derived.length ? derived : CAMPAIGN_LEVEL_FALLBACK_SHOP;
    setShopForServiceList(list);
}
