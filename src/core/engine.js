import { gameTick } from "../sim/traffic.js";
import { setTrafficProfile } from "../sim/economy.js";
import { createService, createConnection, deleteObject, deleteLink as removeLink } from "../sim/tools.js";

const FAILURE_COPY = {
    reputation: {
        title: "REPUTATION LOST",
        message: "Users have abandoned your platform."
    },
    budget: {
        title: "BANKRUPT",
        message: "Funding has been cut."
    }
};

function createInitialState(config = {}) {
    const simulation = {
        time: 0,
        reputation: config.startReputation ?? 100,
        money: config.startBudget ?? 0,
        score: {
            total: 0,
            web: 0,
            api: 0,
            fraudBlocked: 0
        },
        services: [],
        requests: [],
        connections: [],
        internetNode: {
            id: 'internet',
            type: 'internet',
            position: new THREE.Vector3(-40, 0, 0),
            connections: []
        },
        spawnTimer: 0,
        currentRPS: config.baseRPS ?? 0.5,
        requestsProcessed: 0,
        trafficProfile: config.trafficProfile ?? null,
        metrics: {
            droppedByReason: {}
        }
    };

    const ui = {
        activeTool: 'select',
        selectedNodeId: null,
        hovered: null,
        timeScale: config.initialTimeScale ?? 1,
        isRunning: true,
        gameMode: config.mode ?? 'survival',
        sound: null
    };

    return { simulation, ui };
}

function evaluateFailure(simulation) {
    if (!simulation) return null;
    if (simulation.reputation <= 0) {
        return { type: "reputation", ...FAILURE_COPY.reputation };
    }
    if (simulation.money <= -1000) {
        return { type: "budget", ...FAILURE_COPY.budget };
    }
    return null;
}

function asVector(position = {}) {
    if (position instanceof THREE.Vector3) {
        return position.clone();
    }
    const { x = 0, y = 0, z = 0 } = position;
    return new THREE.Vector3(x, y, z);
}

function deleteLinkById(state, linkId) {
    const sim = state.simulation || STATE;
    const target = (sim.connections || []).find(link => link.id === linkId);
    if (target) {
        removeLink(state, target);
    }
}

function upgradeServiceById(serviceId) {
    const svc = (STATE.services || []).find(service => service.id === serviceId);
    if (svc && typeof svc.upgrade === "function") {
        svc.upgrade();
    }
}

export function createEngine(config = {}) {
    const state = createInitialState(config);
    let running = true;

    function step(deltaSeconds) {
        if (!running || !state.ui.isRunning) {
            return { status: state.ui.isRunning ? "paused" : "stopped" };
        }

        state.simulation.time += deltaSeconds;

        // TODO: update gameTick signature to accept state
        gameTick(state, deltaSeconds);

        const failure = evaluateFailure(state.simulation);
        if (failure) {
            running = false;
            state.ui.isRunning = false;
            STATE.isRunning = false; // keep until STATE is removed
            return { status: "gameover", failure };
        }

        return { status: "running" };
    }

    return {
        _state: state,
        getState: () => STATE,
        getSimulation: () => state.simulation,
        getUIState: () => state.ui,
        step,
        isRunning: () => running && state.ui.isRunning,
        setRunning(value) {
            running = Boolean(value);
            state.ui.isRunning = Boolean(value);
            STATE.isRunning = Boolean(value);
        },
        placeService(type, position) {
            if (!type) return;
            createService(state, type, asVector(position));
        },
        connectNodes(fromId, toId) {
            createConnection(state, fromId, toId);
        },
        deleteNode(id) {
            deleteObject(state, id);
        },
        deleteLink(linkId) {
            deleteLinkById(state, linkId);
        },
        upgradeService(id) {
            upgradeServiceById(id);
        },
        setTrafficProfile(profile) {
            setTrafficProfile(profile);
        },
        reset(config) {
            if (typeof window.resetSimulationState === "function") {
                window.resetSimulationState();
            }
            if (config?.trafficProfile) {
                setTrafficProfile(config.trafficProfile);
            }
        },
        getStats() {
            const sim = state.simulation;
            return {
                reputation: sim.reputation,
                budget: sim.money,
                processedByType: {
                    WEB: sim.score?.web ?? 0,
                    API: sim.score?.api ?? 0,
                    FRAUD: sim.score?.fraudBlocked ?? 0
                },
                blockedByType: {
                    FRAUD: sim.score?.fraudBlocked ?? 0
                },
                droppedByReason: sim.metrics?.droppedByReason ?? {}
            };
        },
        getFailureCopy(reasonType) {
            return FAILURE_COPY[reasonType] || null;
        }
    };
}
