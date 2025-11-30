import { showGameOverModal, hideGameOverModal } from "./hudController.js";
import { getLevelsForDomain } from "../config/campaign/index.js";

const TRAFFIC_TYPES = (typeof window !== "undefined" && window.TRAFFIC_TYPES) ? window.TRAFFIC_TYPES : {};

const WIN_CONDITIONS = {
    baby1_packets_10s: {
        type: 'inboundDelivered',
        target: 10,
        successTitle: 'LEVEL COMPLETE',
        successMessage: count => `Delivered ${count} safe packets home. The user is thrilled!`
    }
};

const FAIL_CONDITIONS = {
    baby_no_packets_timeout: {
        type: 'inboundQuiet',
        timeoutSeconds: 60,
        failureTitle: 'NO SIGNAL DETECTED',
        failureMessage: 'No packets reached the user for over a minute. Show them a working link next time.'
    }
};

let engineRef = null;
let subscriptions = [];
let levelState = {
    status: 'idle',
    activeLevelId: null,
    nextLevelId: null,
    inboundDelivered: 0,
    lastInboundTime: 0,
    winConfig: null,
    failConfig: null
};

function disposeSubscriptions() {
    if (subscriptions.length) {
        subscriptions.forEach(unsub => unsub?.());
        subscriptions = [];
    }
}

export function initLevelConditions(engine) {
    disposeSubscriptions();
    engineRef = engine;
    if (!engineRef?.on) return;
    const offFinish = engineRef.on('requestFinished', handleRequestFinished);
    if (typeof offFinish === 'function') {
        subscriptions.push(offFinish);
    }
}

export function disposeLevelConditions() {
    disposeSubscriptions();
    engineRef = null;
}

export function resetLevelConditions() {
    levelState = {
        status: 'idle',
        activeLevelId: null,
        nextLevelId: null,
        inboundDelivered: 0,
        lastInboundTime: engineRef?.getSimulation?.()?.time ?? 0,
        winConfig: null,
        failConfig: null
    };
}

export function configureLevelConditions(level) {
    if (!level) {
        resetLevelConditions();
        return;
    }
    levelState.status = 'armed';
    levelState.activeLevelId = level.id;
    levelState.inboundDelivered = 0;
    levelState.winConfig = WIN_CONDITIONS[level.winConditionId] || null;
    levelState.failConfig = FAIL_CONDITIONS[level.failConditionId] || null;
    const simTime = engineRef?.getSimulation?.()?.time ?? 0;
    levelState.lastInboundTime = simTime;
    levelState.nextLevelId = getNextLevelId(level);
}

function getNextLevelId(level) {
    if (!level) return null;
    const levels = getLevelsForDomain(level.domainId) || [];
    const idx = levels.findIndex(entry => entry.id === level.id);
    if (idx === -1) return null;
    return levels[idx + 1]?.id || null;
}

function handleRequestFinished(payload) {
    if (!payload || levelState.status !== 'armed') return;
    const inboundType = TRAFFIC_TYPES?.INBOUND || 'INBOUND';
    if (payload.type === inboundType) {
        const simTime = engineRef?.getSimulation?.()?.time ?? levelState.lastInboundTime;
        levelState.lastInboundTime = simTime;
        if (levelState.winConfig?.type === 'inboundDelivered') {
            levelState.inboundDelivered += 1;
            if (levelState.inboundDelivered >= levelState.winConfig.target) {
                triggerVictory();
            }
        }
    }
}

export function updateLevelConditions(engine) {
    if (levelState.status !== 'armed') return;
    const sim = engine?.getSimulation?.();
    if (!sim) return;
    if (levelState.failConfig?.type === 'inboundQuiet') {
        const elapsed = (sim.time ?? 0) - (levelState.lastInboundTime ?? 0);
        if (elapsed >= levelState.failConfig.timeoutSeconds) {
            triggerFailure();
        }
    }
}

function pauseSimulation() {
    engineRef?.setRunning(false);
    if (typeof window.setTimeScale === 'function') {
        window.setTimeScale(0);
    }
}

function triggerVictory() {
    if (levelState.status !== 'armed') return;
    levelState.status = 'won';
    pauseSimulation();
    const description = levelState.winConfig?.successMessage?.(levelState.inboundDelivered)
        || 'Objective complete.';
    const title = levelState.winConfig?.successTitle || 'SUCCESS';
    const actions = buildVictoryActions();
    showGameOverModal({ title, message: description }, actions);
}

function triggerFailure() {
    if (levelState.status !== 'armed') return;
    levelState.status = 'failed';
    pauseSimulation();
    const title = levelState.failConfig?.failureTitle || 'MISSION FAILED';
    const message = levelState.failConfig?.failureMessage || 'Objective failed.';
    const actions = [
        {
            label: 'Try Again',
            onClick: () => {
                hideGameOverModal();
                window.resetLevel?.();
            }
        },
        {
            label: 'Return Home',
            onClick: () => {
                hideGameOverModal();
                window.exitLevelToCampaignHub?.();
            }
        }
    ];
    showGameOverModal({ title, message }, actions);
}

function buildVictoryActions() {
    const actions = [];
    actions.push({
        label: 'Domain Menu',
        onClick: () => {
            hideGameOverModal();
            window.exitLevelToCampaignHub?.();
        }
    });
    actions.push({
        label: 'Restart Level',
        onClick: () => {
            hideGameOverModal();
            window.resetLevel?.();
        }
    });
    if (levelState.nextLevelId) {
        actions.push({
            label: 'Next Level',
            onClick: () => {
                hideGameOverModal();
                window.POP?.startCampaignLevel?.(levelState.nextLevelId);
            }
        });
    }
    return actions;
}