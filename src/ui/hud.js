import { setSandboxShop } from "./shop.js";
import { GAME_MODES } from "../modes/constants.js";

const CAMPAIGN_INTRO_OBJECTIVES = [
    { text: "Choose the tutorial level to begin Baby's First Network.", colorClass: 'bg-blue-500', pulse: true },
    { text: 'Follow each mission briefing carefully to unlock the next node.', colorClass: 'bg-slate-500' }
];

const BODY_MODE_CLASSES = {
    [GAME_MODES.CAMPAIGN]: 'campaign-mode',
    [GAME_MODES.SANDBOX]: 'sandbox-mode',
    [GAME_MODES.SCENARIOS]: 'scenarios-mode'
};

let currentView = 'main-menu';
let faqSource = 'menu';
let currentModeId = null;
let objectivesPanelVisible = false;

function updateElementText(id, text = '') {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = text || '';
    }
}

function renderObjectivesList(listElement, entries = []) {
    if (!listElement) return;
    listElement.innerHTML = '';
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
        listElement.appendChild(li);
    });
}

// --- Unified Campaign Panel Functions ---

export function setCampaignPanelTitle(title) {
    updateElementText('campaign-panel-title', title);
}

export function setCampaignPanelSeries(series) {
    updateElementText('campaign-panel-series', series);
}

export function setCampaignPanelIntro(text) {
    updateElementText('campaign-panel-intro', text);
}

export function renderCampaignObjectives(entries) {
    renderObjectivesList(document.getElementById('campaign-panel-objectives'), entries);
}

export function showCampaignPanel(show = true) {
    const panel = document.getElementById('campaign-panel');
    if (panel) panel.classList.toggle('hidden', !show);
}

export function showScenarioPanel(show = true) {
    const panel = document.getElementById('scenarios-panel');
    if (panel) panel.classList.toggle('hidden', !show);
}

// --- Scenario Panel Functions ---

export function setScenarioPanelTitle(text) {
    updateElementText('scenarios-panel-title', text);
}

export function setScenarioPanelSubtitle(text) {
    updateElementText('scenarios-panel-subtitle', text);
}

export function setScenarioPanelSummary(text) {
    updateElementText('scenarios-panel-summary', text);
}

export function setScenarioPanelDifficulty(text) {
    const normalized = text ? String(text).toUpperCase() : '';
    updateElementText('scenarios-panel-difficulty', normalized);
}

export function setScenarioPanelStatus(text) {
    updateElementText('scenarios-panel-status', text);
}

export function setScenarioPanelTags(tags = []) {
    const container = document.getElementById('scenarios-panel-tags');
    if (!container) return;
    container.innerHTML = '';
    tags.filter(Boolean).forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'px-2 py-0.5 text-[10px] rounded-full border border-purple-500/30 text-purple-200/80 uppercase tracking-[0.3em] font-mono';
        pill.innerText = tag;
        container.appendChild(pill);
    });
}

export function renderScenarioObjectives(entries) {
    renderObjectivesList(document.getElementById('scenarios-panel-objectives'), entries);
}

function handleTimeScaleChange(event) {
    if (currentModeId !== GAME_MODES.SCENARIOS) return;
    const scale = event?.detail?.scale ?? 0;
    setScenarioPanelStatus(scale === 0 ? 'Paused' : 'Live');
}

if (typeof window !== 'undefined') {
    window.addEventListener('pop-timeScaleChanged', handleTimeScaleChange);
}

function syncObjectivePanels() {
    const showCampaign = objectivesPanelVisible && currentModeId === GAME_MODES.CAMPAIGN;
    const showScenarios = objectivesPanelVisible && currentModeId === GAME_MODES.SCENARIOS;
    showCampaignPanel(showCampaign);
    showScenarioPanel(showScenarios);
}

export function showLevelInstructionsPanel(visible, modeId = null) {
    if (modeId) {
        currentModeId = modeId;
    }
    showObjectivesPanel(visible);
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
    objectivesPanelVisible = !!show;
    syncObjectivePanels();
}

function updateGameModeLabel(modeId = GAME_MODES.SANDBOX) {
    const label = document.getElementById('game-mode-label');
    if (!label) return;
    let nextText = 'SANDBOX';
    if (modeId === GAME_MODES.CAMPAIGN) nextText = 'CAMPAIGN';
    if (modeId === GAME_MODES.SCENARIOS) nextText = 'SCENARIO';
    label.innerText = nextText;
    label.classList.toggle('text-blue-400', modeId === GAME_MODES.CAMPAIGN);
    label.classList.toggle('text-purple-400', modeId === GAME_MODES.SCENARIOS);
    label.classList.toggle('text-red-500', modeId === GAME_MODES.SANDBOX);
}

function applyBodyMode(modeId = null) {
    const body = document.body;
    if (!body) return;
    Object.values(BODY_MODE_CLASSES).forEach(cls => body.classList.remove(cls));
    if (modeId && BODY_MODE_CLASSES[modeId]) {
        body.classList.add(BODY_MODE_CLASSES[modeId]);
    }
}

export function setModeUIActive(modeId, options = {}) {
    const normalizedMode = modeId ?? null;
    currentModeId = normalizedMode;
    applyBodyMode(normalizedMode);
    updateGameModeLabel(normalizedMode ?? GAME_MODES.SANDBOX);

    const defaultObjectives = normalizedMode === GAME_MODES.CAMPAIGN || normalizedMode === GAME_MODES.SCENARIOS;
    const shouldShowObjectives = options.showObjectives ?? defaultObjectives;
    showObjectivesPanel(!!shouldShowObjectives);

    if (!shouldShowObjectives) {
        showLevelInstructionsPanel(false);
    }
}

function setOverlayState(el, isActive) {
    el.classList.toggle('hidden', !isActive);
    el.style.pointerEvents = isActive ? 'auto' : 'none';
}

export function setHUDMode(mode) {
    const sandboxPanel = document.getElementById('sandbox-panel');
    if (sandboxPanel) sandboxPanel.classList.toggle('hidden', mode !== 'sandbox');
    syncObjectivePanels();
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

    const isGameView = ['sandbox', 'campaign', 'scenarios'].includes(viewName);

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
    } else if (viewName === 'scenarios') {
        setHUDMode('scenarios');
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
    setModeUIActive(null, { showObjectives: false });
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
