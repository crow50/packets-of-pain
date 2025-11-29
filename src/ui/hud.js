import { setSandboxShop } from "./shop.js";

const CAMPAIGN_INTRO_OBJECTIVES = [
    { text: "Choose the tutorial level to begin Baby's First Network.", colorClass: 'bg-blue-500', pulse: true },
    { text: 'Follow each mission briefing carefully to unlock the next node.', colorClass: 'bg-slate-500' }
];

let currentView = 'main-menu';
let faqSource = 'menu';

// --- Unified Campaign Panel Functions ---

export function setCampaignPanelTitle(title) {
    const el = document.getElementById('campaign-panel-title');
    if (el) el.innerText = title || '';
}

export function setCampaignPanelSeries(series) {
    const el = document.getElementById('campaign-panel-series');
    if (el) el.innerText = series || '';
}

export function setCampaignPanelIntro(text) {
    const el = document.getElementById('campaign-panel-intro');
    if (el) el.innerText = text || '';
}

export function renderCampaignObjectives(entries) {
    const list = document.getElementById('campaign-panel-objectives');
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

export function showCampaignPanel(show = true) {
    const panel = document.getElementById('campaign-panel');
    if (panel) panel.classList.toggle('hidden', !show);
}

// Legacy aliases for compatibility
export function setObjectivesTitle(text) {
    setCampaignPanelTitle(text);
}

export function renderObjectives(entries) {
    renderCampaignObjectives(entries);
}

export function setCampaignIntroObjectives() {
    setCampaignPanelTitle('Campaign Briefing');
    setCampaignPanelSeries("baby's first network");
    setCampaignPanelIntro('');
    renderCampaignObjectives(CAMPAIGN_INTRO_OBJECTIVES);
}

export function showObjectivesPanel(show = true) {
    showCampaignPanel(show);
}

function setOverlayState(el, isActive) {
    el.classList.toggle('hidden', !isActive);
    el.style.pointerEvents = isActive ? 'auto' : 'none';
}

export function setHUDMode(mode) {
    const campaignPanel = document.getElementById('campaign-panel');
    const sandboxPanel = document.getElementById('sandbox-panel');

    if (campaignPanel) campaignPanel.classList.toggle('hidden', mode !== 'campaign');
    if (sandboxPanel) sandboxPanel.classList.toggle('hidden', mode !== 'sandbox');

    document.body?.classList.toggle('campaign-mode', mode === 'campaign');
}

export function initWarningsPill() {
    const pill = document.getElementById('warnings-pill');
    const section = document.getElementById('topology-warnings-section');
    if (!pill || !section) return;

    section.dataset.expanded = section.dataset.expanded === 'true' ? 'true' : 'false';
    section.classList.add('hidden');

    pill.addEventListener('click', () => {
        const expanded = section.dataset.expanded === 'true';
        const next = !expanded;
        section.dataset.expanded = next ? 'true' : 'false';
        section.classList.toggle('hidden', !next);
    });
}

export function showView(viewName) {
    const sandboxEl = document.getElementById('game-ui');
    const campaignHubEl = document.getElementById('campaign-hub');
    const menuEl = document.getElementById('main-menu-modal');
    if (!sandboxEl || !campaignHubEl || !menuEl) return;

    const isGameView = viewName === 'sandbox' || viewName === 'campaign';

    setOverlayState(sandboxEl, isGameView);
    setOverlayState(campaignHubEl, viewName === 'campaign-hub');
    setOverlayState(menuEl, viewName === 'main-menu');

    if (viewName !== 'campaign-hub') {
        window.hideCampaignLevels?.();
    }

    if (viewName === 'campaign') {
        setHUDMode('campaign');
    } else if (viewName === 'sandbox') {
        setHUDMode('sandbox');
    } else {
        setHUDMode(null);
    }

    currentView = viewName;
}

export function showMainMenu() {
    const engine = window.__POP_RUNTIME__?.current?.engine;
    const sound = engine?.getUIState()?.sound || window.__menuSound;
    if (sound) {
        if (!sound.ctx) sound.init();
        sound.playMenuBGM?.();
    }
    window.setCampaignUIActive?.(false);
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
