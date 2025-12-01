import { getAllScenarios, getScenarioById } from "../config/scenarios/index.js";
import { setBudget, resetSatisfaction, resetScore, setTrafficProfile } from "../sim/economy.js";
import { updateScore } from "../sim/traffic.js";
import { applyToolbarWhitelist } from "./toolbarController.js";
import { mapWhitelistToServices, setShopForServiceList, setSandboxShop } from "./shop.js";
import { configureTutorial, stopTutorial } from "./tutorialController.js";
import { configureLevelConditions, resetLevelConditions } from "./levelConditions.js";
import { spawnNodeFromConfig } from "./campaign.js";
import {
    renderScenarioObjectives,
    setModeUIActive,
    setScenarioPanelDifficulty,
    setScenarioPanelStatus,
    setScenarioPanelSummary,
    setScenarioPanelTags,
    setScenarioPanelTitle,
    setScenarioPanelSubtitle,
    showLevelInstructionsPanel,
    showView
} from "./hud.js";
import { GAME_MODES } from "../modes/constants.js";

const OBJECTIVE_COLORS = ["bg-purple-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
let cachedScenarios = [];
let previousTimeScale = null;
let lastOpenSource = null;

function formatWorldLabel(value) {
    if (!value) return "Operations Lab";
    return String(value).replace(/[-_]/g, " ");
}

function getCurrentTimeScale() {
    return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.timeScale ?? 0;
}

function pauseForBrowser(source) {
    if (source !== "hud") return;
    previousTimeScale = getCurrentTimeScale();
    if (previousTimeScale !== 0) {
        window.setTimeScale?.(0);
    }
}

function resumeFromBrowser() {
    if (previousTimeScale === null) return;
    if (previousTimeScale !== 0) {
        window.setTimeScale?.(previousTimeScale);
    }
    previousTimeScale = null;
}

function buildTagPill(text) {
    const pill = document.createElement("span");
    pill.className = "px-2 py-0.5 text-[10px] rounded-full border border-purple-500/40 text-purple-200/90 uppercase tracking-widest";
    pill.innerText = text;
    return pill;
}

function buildScenarioCard(scenario) {
    const card = document.createElement("article");
    card.className = "glass-panel border border-purple-500/20 rounded-2xl p-5 flex flex-col gap-4 bg-gradient-to-br from-slate-900/60 to-slate-900/30";

    const header = document.createElement("div");
    header.className = "flex flex-col gap-1";

    const kicker = document.createElement("p");
    kicker.className = "text-[11px] uppercase tracking-[0.4em] text-gray-500";
    kicker.innerText = scenario.worldId ? scenario.worldId.replace(/[-_]/g, " ") : "scenario";
    header.appendChild(kicker);

    const title = document.createElement("h3");
    title.className = "text-2xl font-bold text-white";
    title.innerText = scenario.title || "Scenario";
    header.appendChild(title);

    if (scenario.subtitle) {
        const subtitle = document.createElement("p");
        subtitle.className = "text-sm text-gray-400";
        subtitle.innerText = scenario.subtitle;
        header.appendChild(subtitle);
    }

    card.appendChild(header);

    const summary = document.createElement("p");
    summary.className = "text-sm text-gray-300";
    summary.innerText = scenario.summary || scenario.description || "Stabilize the network.";
    card.appendChild(summary);

    const metaRow = document.createElement("div");
    metaRow.className = "flex flex-wrap gap-2 items-center";

    if (scenario.difficulty) {
        metaRow.appendChild(buildTagPill(`★ ${scenario.difficulty}`));
    }

    if (Array.isArray(scenario.tags)) {
        scenario.tags.slice(0, 3).forEach(tag => {
            const pill = buildTagPill(tag);
            pill.classList.replace("border-purple-500/40", "border-blue-500/30");
            pill.classList.replace("text-purple-200/90", "text-blue-200/90");
            metaRow.appendChild(pill);
        });
    }

    card.appendChild(metaRow);

    const buttonRow = document.createElement("div");
    buttonRow.className = "flex justify-end";
    const startBtn = document.createElement("button");
    startBtn.type = "button";
    startBtn.className = "px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-widest border border-white/20";
    startBtn.innerText = "Start Scenario";
    startBtn.addEventListener("click", () => handleScenarioSelection(scenario.id));
    buttonRow.appendChild(startBtn);
    card.appendChild(buttonRow);

    return card;
}

function renderScenarioList() {
    const container = document.getElementById("scenarios-list");
    if (!container) return;
    container.innerHTML = "";
    cachedScenarios.forEach((scenario) => {
        container.appendChild(buildScenarioCard(scenario));
    });
}

function handleScenarioSelection(scenarioId) {
    if (!scenarioId) return;
    closeScenariosBrowser();
    window.POP?.startScenario?.(scenarioId);
}

function bindModalEvents() {
    const modal = document.getElementById("scenarios-modal");
    if (!modal) return;
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeScenariosBrowser();
        }
    });
}

export function initScenariosController() {
    cachedScenarios = getAllScenarios();
    renderScenarioList();

    const mainMenuButton = document.getElementById("main-menu-scenarios");
    mainMenuButton?.addEventListener("click", () => openScenariosBrowser("menu"));

    const closeBtn = document.getElementById("scenarios-close");
    closeBtn?.addEventListener("click", () => closeScenariosBrowser());

    bindModalEvents();

    document.addEventListener("keydown", (event) => {
        const modal = document.getElementById("scenarios-modal");
        if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            closeScenariosBrowser();
        }
    });
}

export function openScenariosBrowser(source = "menu") {
    const modal = document.getElementById("scenarios-modal");
    if (!modal) return;
    lastOpenSource = source;
    if (source === "menu") {
        document.getElementById("main-menu-modal")?.classList.add("hidden");
    }
    renderScenarioList();
    modal.classList.remove("hidden");
    pauseForBrowser(source);
}

export function closeScenariosBrowser() {
    const modal = document.getElementById("scenarios-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    if (lastOpenSource === "menu") {
        document.getElementById("main-menu-modal")?.classList.remove("hidden");
    }
    resumeFromBrowser();
    lastOpenSource = null;
}

function mapInstructionsToObjectives(instructions = []) {
    if (!Array.isArray(instructions) || !instructions.length) {
        return [
            {
                text: "Stabilize the topology using the briefing below.",
                colorClass: OBJECTIVE_COLORS[0]
            }
        ];
    }
    return instructions.map((text, index) => ({
        text,
        colorClass: OBJECTIVE_COLORS[index % OBJECTIVE_COLORS.length]
    }));
}

export function loadScenarioSession(scenarioId, fallbackConfig = null) {
    const scenario = fallbackConfig || getScenarioById(scenarioId);
    if (!scenario) {
        console.error("[Scenarios] Missing scenario config", scenarioId);
        return null;
    }

    const engine = window.__POP_RUNTIME__?.current?.engine;
    setModeUIActive(GAME_MODES.SCENARIOS);
    showLevelInstructionsPanel(true, GAME_MODES.SCENARIOS);
    showView("scenarios");
    window.setTool?.("select");
    window.setTimeScale?.(0);

    resetLevelConditions();
    stopTutorial();

    setBudget(Number.isFinite(scenario.startingBudget) ? scenario.startingBudget : 0);
    resetSatisfaction();
    resetScore();
    updateScore();
    setTrafficProfile(scenario.trafficProfile || null);

    const whitelist = Array.isArray(scenario.toolbarWhitelist) ? scenario.toolbarWhitelist : [];
    applyToolbarWhitelist(whitelist);
    const serviceList = mapWhitelistToServices(whitelist);
    if (serviceList.length) {
        setShopForServiceList(serviceList);
    } else {
        setSandboxShop();
    }

    if (Array.isArray(scenario.preplacedNodes)) {
        scenario.preplacedNodes.forEach(spawnNodeFromConfig);
    }

    setScenarioPanelTitle(scenario.title || "Scenario");
    setScenarioPanelSubtitle(scenario.subtitle || formatWorldLabel(scenario.worldId));
    setScenarioPanelSummary(scenario.summary || scenario.description || "");
    setScenarioPanelDifficulty(scenario.difficulty || "");
    setScenarioPanelTags(Array.isArray(scenario.tags) ? scenario.tags : []);
    setScenarioPanelStatus("Paused");
    renderScenarioObjectives(mapInstructionsToObjectives(scenario.instructions));

    engine?.setTopologyGuidance(Array.isArray(scenario.topologyGuidance) ? scenario.topologyGuidance : []);

    configureLevelConditions(scenario);
    configureTutorial(scenario, engine);

    return scenario;
}

if (typeof window !== "undefined") {
    window.openScenariosBrowser = openScenariosBrowser;
    window.closeScenariosBrowser = closeScenariosBrowser;
}

