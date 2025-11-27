import { setSandboxShop } from "./shop.js";

const SANDBOX_OBJECTIVES = [
    { text: 'Survive Endless Traffic', colorClass: 'bg-red-500', pulse: true },
    { text: 'Route WEB traffic to Object Storage', colorClass: 'bg-green-500' },
    { text: 'Route API traffic to Database', colorClass: 'bg-yellow-500' },
    { text: 'Block FRAUD traffic with WAF', colorClass: 'bg-purple-500' }
];

const CAMPAIGN_INTRO_OBJECTIVES = [
    { text: "Choose the tutorial level to begin Baby's First Network.", colorClass: 'bg-blue-500', pulse: true },
    { text: 'Follow each mission briefing carefully to unlock the next node.', colorClass: 'bg-slate-500' }
];

let currentView = 'main-menu';
let faqSource = 'menu';

function setOverlayState(el, isActive) {
    el.classList.toggle('hidden', !isActive);
    el.style.pointerEvents = isActive ? 'auto' : 'none';
}

export function showView(viewName) {
    const sandboxEl = document.getElementById('sandbox-ui');
    const campaignEl = document.getElementById('campaign-hub');
    const menuEl = document.getElementById('main-menu-modal');
    if (!sandboxEl || !campaignEl || !menuEl) return;

    setOverlayState(sandboxEl, viewName === 'sandbox');
    setOverlayState(campaignEl, viewName === 'campaign');
    setOverlayState(menuEl, viewName === 'main-menu');

    if (viewName !== 'campaign') {
        window.hideCampaignLevels?.();
    }

    currentView = viewName;
}

export function showMainMenu() {
    if (!STATE.sound.ctx) STATE.sound.init();
    STATE.sound.playMenuBGM();
    window.setCampaignUIActive?.(false);
    setSandboxObjectivesPanel();
    setSandboxShop();

    document.getElementById('main-menu-modal')?.classList.remove('hidden');
    document.getElementById('faq-modal')?.classList.add('hidden');
    document.getElementById('modal')?.classList.add('hidden');
    showView('main-menu');
    window.setTool('select');
}

export function showFAQ(source = 'menu') {
    faqSource = source;
    const menuModal = document.getElementById('main-menu-modal');
    const faqModal = document.getElementById('faq-modal');
    if (!menuModal || !faqModal) return;

    if (!menuModal.classList.contains('hidden')) {
        faqSource = 'menu';
        menuModal.classList.add('hidden');
    } else {
        faqSource = 'game';
    }

    faqModal.classList.remove('hidden');
}

export function closeFAQ() {
    const faqModal = document.getElementById('faq-modal');
    if (!faqModal) return;
    faqModal.classList.add('hidden');
    if (faqSource === 'menu') {
        document.getElementById('main-menu-modal')?.classList.remove('hidden');
    }
}

export function setObjectivesTitle(text) {
    const title = document.getElementById('objectives-title');
    if (title) title.innerText = text;
}

export function renderObjectives(entries) {
    const list = document.getElementById('objectives-list');
    if (!list) return;
    list.innerHTML = '';
    entries.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'flex items-center';
        const dot = document.createElement('span');
        dot.className = `w-2 h-2 rounded-full mr-2 ${entry.colorClass || 'bg-gray-500'}`;
        if (entry.pulse) dot.classList.add('animate-pulse');
        li.appendChild(dot);
        const text = document.createElement('span');
        text.innerText = entry.text;
        li.appendChild(text);
        list.appendChild(li);
    });
}

export function setSandboxObjectivesPanel() {
    setObjectivesTitle('Current Objectives');
    renderObjectives(SANDBOX_OBJECTIVES);
}

export function setCampaignIntroObjectives() {
    setObjectivesTitle('Campaign Briefing');
    renderObjectives(CAMPAIGN_INTRO_OBJECTIVES);
}
