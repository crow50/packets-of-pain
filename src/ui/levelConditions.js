import { showGameOverModal, hideGameOverModal } from "./hudController.js";
import { getLevelsForDomain } from "../config/campaign/index.js";
import { setTimeScale } from "../sim/economy.js";
import { TRAFFIC_CLASS, PACKET_PHASE } from "../config/packetConfig.js";
import { resetLevel, exitLevelToCampaignHub, startCampaignLevel as startCampaignLevelNavigation } from "./campaign.js";

const WIN_OBJECTIVES = {
    baby1_packets_10s: {
        type: 'inboundDelivered',
        target: 10,
        successTitle: 'LEVEL COMPLETE',
        successMessage: ({ inboundDelivered = 0 }) => `Delivered ${inboundDelivered} safe packets home. The user is thrilled!`
    },
    scenario_ddos_block_wave: {
        type: 'blockedPackets',
        target: 80,
        successTitle: 'WAVE CONTAINED',
        successMessage: ({ blockedPackets = 0 }) => `Absorbed ${blockedPackets} hostile packets before they breached production.`
    },
    scenario_launch_uptime: {
        type: 'requestsProcessed',
        target: 500,
        minReputation: 80,
        successTitle: 'SLO MAINTAINED',
        successMessage: ({ processed = 0 }) => `Processed ${processed} launch requests while keeping reputation above target.`
    },
    scenario_sandbox_budget: {
        type: 'budgetDuration',
        durationSeconds: 90,
        minBudget: 0,
        successTitle: 'STABLE OPERATOR',
        successMessage: () => 'You stayed solvent for the entire surge window.'
    }
};

const FAIL_OBJECTIVES = {
    baby_no_packets_timeout: {
        type: 'inboundQuiet',
        timeoutSeconds: 60,
        failureTitle: 'NO SIGNAL DETECTED',
        failureMessage: 'No packets reached the user for over a minute. Show them a working link next time.'
    },
    scenario_budget_collapse: {
        type: 'budgetBelow',
        threshold: 0,
        failureTitle: 'INSOLVENT',
        failureMessage: 'Budget dropped below zero. Reset and re-balance spending.'
    },
    scenario_reputation_crash: {
        type: 'reputationBelow',
        threshold: 60,
        graceSeconds: 5,
        failureTitle: 'CUSTOMERS LOST',
        failureMessage: 'Reputation stayed below 60 for too long. The launch failed.'
    },
    baby_generic_satisfaction_or_score: {
        type: 'reputationBelow',
        threshold: 20,
        graceSeconds: 0,
        failureTitle: 'MISSION FAILED',
        failureMessage: 'Keep reputation healthy while meeting objectives.'
    }
};

let engineRef = null;
let subscriptions = [];

function resolveObjectiveFromLibrary(id, library) {
    if (!id) return null;
    const definition = library[id];
    if (!definition) return null;
    const clone = { ...definition };
    clone.id = definition.id || id;
    return clone;
}

function cloneObjective(definition, fallbackId) {
    if (!definition) return null;
    const clone = { ...definition };
    if (!clone.id && fallbackId) {
        clone.id = fallbackId;
    }
    return clone;
}

let levelState = {
    status: 'idle',
    activeLevelId: null,
    nextLevelId: null,
    winObjective: null,
    failObjective: null,
    progress: {
        inboundDelivered: 0,
        lastInboundTime: 0,
        baseline: {},
        reputationStableSince: 0,
        budgetStableSince: 0,
        reputationBelowSince: null
    }
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
        winObjective: null,
        failObjective: null,
        progress: {
            inboundDelivered: 0,
            lastInboundTime: engineRef?.getSimulation?.()?.time ?? 0,
            baseline: {},
            reputationStableSince: 0,
            budgetStableSince: 0,
            reputationBelowSince: null
        }
    };
}

export function configureLevelConditions(level) {
    if (!level) {
        resetLevelConditions();
        return;
    }
    const sim = engineRef?.getSimulation?.();
    const objectiveOverrides = level.objectiveConfig || {};
    const winObjective = objectiveOverrides.win
        ? cloneObjective(objectiveOverrides.win, `${level.id}-win`)
        : resolveObjectiveFromLibrary(level.winConditionId, WIN_OBJECTIVES);
    const failObjective = objectiveOverrides.fail
        ? cloneObjective(objectiveOverrides.fail, `${level.id}-fail`)
        : resolveObjectiveFromLibrary(level.failConditionId, FAIL_OBJECTIVES);

    levelState.status = 'armed';
    levelState.activeLevelId = level.id;
    levelState.nextLevelId = getNextLevelId(level);
    levelState.winObjective = winObjective;
    levelState.failObjective = failObjective;
    levelState.progress = {
        inboundDelivered: 0,
        lastInboundTime: sim?.time ?? 0,
        baseline: {
            fraudBlocked: sim?.score?.fraudBlocked ?? 0,
            requestsProcessed: sim?.requestsProcessed ?? 0,
            money: sim?.money ?? 0
        },
        reputationStableSince: sim?.time ?? 0,
        budgetStableSince: sim?.time ?? 0,
        reputationBelowSince: null
    };
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
    // Check for response phase (new model) or legacy INBOUND type
    const isResponse = payload.phase === PACKET_PHASE?.RESPONSE || payload.type === 'INBOUND';
    if (isResponse) {
        const simTime = engineRef?.getSimulation?.()?.time ?? levelState.progress.lastInboundTime;
        levelState.progress.lastInboundTime = simTime;
        levelState.progress.inboundDelivered += 1;
    }
    evaluateObjectives();
}

function objectiveSatisfied(objective, sim) {
    if (!objective) return false;
    const progress = levelState.progress;
    switch (objective.type) {
        case 'inboundDelivered':
            return progress.inboundDelivered >= (objective.target ?? 0);
        case 'inboundQuiet': {
            const elapsed = (sim.time ?? 0) - (progress.lastInboundTime ?? 0);
            return elapsed >= (objective.timeoutSeconds ?? 0);
        }
        case 'blockedPackets': {
            const blocked = (sim.score?.fraudBlocked ?? 0) - (progress.baseline.fraudBlocked ?? 0);
            progress.blockedPackets = blocked;
            return blocked >= (objective.target ?? 0);
        }
        case 'requestsProcessed': {
            const processed = (sim.requestsProcessed ?? 0) - (progress.baseline.requestsProcessed ?? 0);
            progress.requestsProcessed = processed;
            const reputationOk = (sim.reputation ?? 100) >= (objective.minReputation ?? 0);
            return processed >= (objective.target ?? 0) && reputationOk;
        }
        case 'budgetDuration': {
            if ((sim.money ?? 0) >= (objective.minBudget ?? 0)) {
                if (!progress.budgetStableSince) {
                    progress.budgetStableSince = sim.time ?? 0;
                }
                const held = (sim.time ?? 0) - (progress.budgetStableSince ?? 0);
                return held >= (objective.durationSeconds ?? 0);
            }
            progress.budgetStableSince = null;
            return false;
        }
        case 'budgetBelow':
            return (sim.money ?? 0) <= (objective.threshold ?? 0);
        case 'reputationBelow': {
            if ((sim.reputation ?? 100) < (objective.threshold ?? 0)) {
                if (!progress.reputationBelowSince) {
                    progress.reputationBelowSince = sim.time ?? 0;
                }
                const elapsed = (sim.time ?? 0) - (progress.reputationBelowSince ?? 0);
                return elapsed >= (objective.graceSeconds ?? 0);
            }
            progress.reputationBelowSince = null;
            return false;
        }
        default:
            return false;
    }
}

function evaluateObjectives(passedEngine) {
    if (levelState.status !== 'armed') return;
    const sim = passedEngine?.getSimulation?.() ?? engineRef?.getSimulation?.();
    if (!sim) return;
    if (levelState.winObjective && objectiveSatisfied(levelState.winObjective, sim)) {
        triggerVictory();
        return;
    }
    if (levelState.failObjective && objectiveSatisfied(levelState.failObjective, sim)) {
        triggerFailure();
    }
}

export function updateLevelConditions(engine) {
    evaluateObjectives(engine);
}

function pauseSimulation() {
    engineRef?.setRunning(false);
    setTimeScale(0);
}

function triggerVictory() {
    if (levelState.status !== 'armed') return;
    levelState.status = 'won';
    pauseSimulation();
    const description = typeof levelState.winObjective?.successMessage === 'function'
        ? levelState.winObjective.successMessage(levelState.progress)
        : (levelState.winObjective?.successMessage || 'Objective complete.');
    const title = levelState.winObjective?.successTitle || 'SUCCESS';
    const actions = buildVictoryActions();
    showGameOverModal({ title, message: description }, actions);
}

function triggerFailure() {
    if (levelState.status !== 'armed') return;
    levelState.status = 'failed';
    pauseSimulation();
    const title = levelState.failObjective?.failureTitle || 'MISSION FAILED';
    const message = typeof levelState.failObjective?.failureMessage === 'function'
        ? levelState.failObjective.failureMessage(levelState.progress)
        : (levelState.failObjective?.failureMessage || 'Objective failed.');
    const actions = [
        {
            label: 'Try Again',
            onClick: () => {
                hideGameOverModal();
                resetLevel();
            }
        },
        {
            label: 'Return Home',
            onClick: () => {
                hideGameOverModal();
                exitLevelToCampaignHub();
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
            exitLevelToCampaignHub();
        }
    });
    actions.push({
        label: 'Restart Level',
        onClick: () => {
            hideGameOverModal();
            resetLevel();
        }
    });
    if (levelState.nextLevelId) {
        actions.push({
            label: 'Next Level',
            onClick: () => {
                hideGameOverModal();
                startCampaignLevelNavigation(levelState.nextLevelId);
            }
        });
    }
    return actions;
}
