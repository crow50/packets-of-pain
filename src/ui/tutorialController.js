import { GameContext } from "../sim/economy.js";
import { applyToolbarWhitelist } from "./toolbarController.js";

let tutorialState = null;
let pendingTrigger = null;
let triggerCleanup = null;

const TIME_BUTTON_IDS = ["btn-pause", "btn-play", "btn-fast"]; // restart stays outside tutorial lock

function getCurrentStep() {
    if (!tutorialState) return null;
    return tutorialState.steps[tutorialState.index] || null;
}

function clearTriggerListener() {
    if (typeof triggerCleanup === "function") {
        triggerCleanup();
        triggerCleanup = null;
    }
    pendingTrigger = null;
}

function getTutorialBox() {
    return document.getElementById("tutorial-box");
}

function setTutorialVisibility(visible) {
    const box = getTutorialBox();
    if (box) {
        box.classList.toggle("hidden", !visible);
    }
}

function updateStepCounter() {
    const counter = document.getElementById("tutorial-step-counter");
    if (!counter || !tutorialState) return;
    const total = tutorialState.steps.length;
    const current = Math.min(tutorialState.index + 1, total);
    counter.innerText = total > 0 ? `${current} / ${total}` : "";
}

function setTutorialText(text) {
    const textEl = document.getElementById("tutorial-text");
    if (textEl) {
        textEl.innerText = text || "";
    }
}

function clearHighlights() {
    document.querySelectorAll(".tutorial-highlight").forEach(el => {
        el.classList.remove("tutorial-highlight");
    });
}

function applyHighlight(highlight) {
    if (!highlight) return;
    if (highlight.elementId) {
        const el = document.getElementById(highlight.elementId);
        if (el) {
            el.classList.add("tutorial-highlight");
        }
    }
}

function applyToolbarForStep(step) {
    if (!tutorialState) return;
    if (step?.toolWhitelist && step.toolWhitelist.length) {
        applyToolbarWhitelist(step.toolWhitelist);
    } else {
        applyToolbarWhitelist(tutorialState.baseToolbarWhitelist);
    }
}

function setTimeControlRestriction(targetButtonId) {
    const target = targetButtonId || null;
    TIME_BUTTON_IDS.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const lock = Boolean(target && id !== target);
        btn.disabled = lock;
        btn.classList.toggle("tutorial-disabled", lock);
    });
}

function showCurrentStep() {
    if (!tutorialState) return;
    const step = getCurrentStep();
    if (!step) {
        completeTutorial();
        return;
    }

    setTutorialVisibility(true);
    updateStepCounter();
    setTutorialText(step.text);

    clearHighlights();
    applyHighlight(step.highlight);
    applyToolbarForStep(step);

    const lockTarget = getTimeControlTargetForStep(step);
    setTimeControlRestriction(lockTarget);
}

function resolveDefaultTimeControlTarget(tutorialConfig) {
    if (!tutorialConfig) return 'btn-pause';
    if (tutorialConfig.defaultTimeControlTarget === null) return null;
    if (typeof tutorialConfig.defaultTimeControlTarget === 'string') {
        return tutorialConfig.defaultTimeControlTarget;
    }
    return tutorialConfig.lockTimeByDefault === false ? null : 'btn-pause';
}

function getTimeControlTargetForStep(step) {
    if (!tutorialState) return null;
    if (step?.allowAllTimeControls) return null;
    if (step?.timeControlTarget || step?.lockTimeControlTo) {
        return step.timeControlTarget || step.lockTimeControlTo || null;
    }
    return tutorialState.defaultTimeControlTarget ?? null;
}

function normalizeServiceType(value) {
    return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function resolveNodeType(sim, nodeId) {
    if (!nodeId || !sim) return null;
    if (nodeId === "internet") return "INTERNET";
    const svc = sim.services?.find(s => s.id === nodeId);
    if (!svc) return null;
    return normalizeServiceType(svc.type);
}

function countConnectionsForServiceType(sim, serviceType) {
    const desired = normalizeServiceType(serviceType);
    if (!desired || !Array.isArray(sim?.services)) return 0;
    const ids = sim.services
        .filter(s => normalizeServiceType(s.type) === desired)
        .map(s => s.id);
    if (!ids.length || !Array.isArray(sim.connections)) return 0;
    let maxConnections = 0;
    ids.forEach(id => {
        const connections = sim.connections.reduce((count, link) => {
            return count + ((link.from === id || link.to === id) ? 1 : 0);
        }, 0);
        if (connections > maxConnections) {
            maxConnections = connections;
        }
    });
    return maxConnections;
}

function hasConnectionBetween(sim, cond) {
    if (!sim || !Array.isArray(sim.connections)) return false;
    const desiredFrom = normalizeServiceType(cond.fromType);
    const desiredTo = normalizeServiceType(cond.toType);
    const desiredFromId = typeof cond.fromId === "string" ? cond.fromId : null;
    const desiredToId = typeof cond.toId === "string" ? cond.toId : null;
    const bidirectional = Boolean(cond.bidirectional);

    return sim.connections.some(link => {
        const fromType = resolveNodeType(sim, link.from);
        const toType = resolveNodeType(sim, link.to);
        if (!fromType || !toType) return false;
        const forwardMatch = (
            (!desiredFromId || link.from === desiredFromId) &&
            (!desiredToId || link.to === desiredToId) &&
            (!desiredFrom || fromType === desiredFrom) &&
            (!desiredTo || toType === desiredTo)
        );
        if (forwardMatch) return true;
        if (bidirectional) {
            const reverseMatch = (
                (!desiredFromId || link.to === desiredFromId) &&
                (!desiredToId || link.from === desiredToId) &&
                (!desiredFrom || toType === desiredFrom) &&
                (!desiredTo || fromType === desiredTo)
            );
            if (reverseMatch) return true;
        }
        return false;
    });
}

function checkCondition(cond, engine) {
    if (!cond || !engine) return false;
    const sim = engine.getSimulation();
    const ui = engine.getUIState();

    switch (cond.type) {
        case "activeToolIs": {
            const target = typeof cond.toolId === "string" ? cond.toolId.toLowerCase() : cond.toolId;
            const current = ui?.activeTool?.toLowerCase?.();
            return Boolean(target) && current === target;
        }
        case "hasServiceOfType": {
            const desired = normalizeServiceType(cond.serviceType);
            if (!desired || !Array.isArray(sim?.services)) return false;
            const count = sim.services.filter(s => normalizeServiceType(s.type) === desired).length;
            const min = typeof cond.countAtLeast === "number" ? cond.countAtLeast : 1;
            return count >= min;
        }
        case "hasConnectionBetween":
            return hasConnectionBetween(sim, cond);
        case "timeScaleAtLeast": {
            const value = typeof cond.value === "number" ? cond.value : 1;
            const scale = ui?.timeScale ?? 0;
            return scale >= value;
        }
        case "serviceConnectionsAtLeast": {
            const min = typeof cond.countAtLeast === "number" ? cond.countAtLeast : 1;
            return countConnectionsForServiceType(sim, cond.serviceType) >= min;
        }
        case "allOf": {
            if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) return false;
            return cond.conditions.every(child => checkCondition(child, engine));
        }
        case "anyOf": {
            if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) return false;
            return cond.conditions.some(child => checkCondition(child, engine));
        }
        default:
            return false;
    }
}

function advanceStep() {
    if (!tutorialState) return;
    tutorialState.index += 1;
    const nextStep = getCurrentStep();
    if (!nextStep) {
        completeTutorial();
        return;
    }
    showCurrentStep();
}

function completeTutorial() {
    if (!tutorialState) return;
    setTutorialVisibility(false);
    setTutorialText("");
    updateStepCounter();
    clearHighlights();
    applyToolbarWhitelist(tutorialState.baseToolbarWhitelist);
    setTimeControlRestriction(null);
    tutorialState = null;
}

export function startTutorial(levelConfig, engine) {
    if (!levelConfig?.tutorial?.enabled || !engine) {
        stopTutorial();
        return;
    }

    stopTutorial();

    tutorialState = {
        levelId: levelConfig.id,
        steps: Array.isArray(levelConfig.tutorial.steps) ? levelConfig.tutorial.steps : [],
        index: 0,
        engine,
        baseToolbarWhitelist: Array.isArray(GameContext.toolbarWhitelist)
            ? [...GameContext.toolbarWhitelist]
            : [],
        defaultTimeControlTarget: resolveDefaultTimeControlTarget(levelConfig.tutorial)
    };

    showCurrentStep();
}

export function updateTutorial(engine) {
    if (!tutorialState || !engine) return;
    if (tutorialState.engine !== engine) {
        tutorialState.engine = engine;
    }
    const step = getCurrentStep();
    if (!step) return;
    if (checkCondition(step.condition, engine)) {
        advanceStep();
    }
}

export function stopTutorial() {
    clearTriggerListener();
    if (!tutorialState) {
        setTutorialVisibility(false);
        clearHighlights();
        return;
    }
    applyToolbarWhitelist(tutorialState.baseToolbarWhitelist);
    setTimeControlRestriction(null);
    tutorialState = null;
    setTutorialVisibility(false);
    setTutorialText("");
    updateStepCounter();
    clearHighlights();
}

export function skipTutorial() {
    stopTutorial();
}

window.skipTutorial = skipTutorial;

function scheduleTrigger(triggerConfig = {}, levelConfig, engine) {
    clearTriggerListener();
    const type = triggerConfig.type || triggerConfig.startOn || "level-start";

    if (type === "engine-event") {
        const eventName = triggerConfig.eventName;
        if (!eventName || typeof engine?.on !== "function") {
            startTutorial(levelConfig, engine);
            return;
        }
        pendingTrigger = { levelConfig, engine };
        triggerCleanup = engine.on(eventName, () => {
            clearTriggerListener();
            startTutorial(levelConfig, engine);
        });
        return;
    }

    // Default: start immediately when level loads
    startTutorial(levelConfig, engine);
}

export function configureTutorial(levelConfig, engine) {
    if (!levelConfig?.tutorial?.enabled || !engine) {
        stopTutorial();
        return;
    }

    const trigger = levelConfig.tutorial.trigger || { type: "level-start" };
    scheduleTrigger(trigger, levelConfig, engine);
}
