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
    const isSandbox = config.mode === 'sandbox';
    
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
        },
        // Sandbox-specific fields (defaults from config or gameConfig)
        upkeepEnabled: config.upkeepEnabled ?? !isSandbox,
        trafficDistribution: config.trafficDistribution ?? null,
        burstCount: config.burstCount ?? 10
    };

    const ui = {
        activeTool: 'select',
        selectedNodeId: null,
        linkSourceId: null,  // First node selected in connect mode
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
    const sim = state.simulation;
    const target = (sim.connections || []).find(link => link.id === linkId);
    if (target) {
        removeLink(state, target);
    }
}

function upgradeServiceById(state, serviceId) {
    const sim = state.simulation;
    const svc = (sim.services || []).find(service => service.id === serviceId);
    if (svc && typeof svc.upgrade === "function") {
        svc.upgrade(state);
    }
}

export function createEngine(config = {}) {
    const state = createInitialState(config);
    let running = true;
    const _listeners = new Map();

    function step(deltaSeconds) {
        if (!running || !state.ui.isRunning) {
            return { status: state.ui.isRunning ? "paused" : "stopped" };
        }

        state.simulation.time += deltaSeconds;

        gameTick(state, deltaSeconds);

        // Skip game over evaluation in sandbox mode
        if (state.ui.gameMode !== 'sandbox') {
            const failure = evaluateFailure(state.simulation);
            if (failure) {
                running = false;
                state.ui.isRunning = false;
                return { status: "gameover", failure };
            }
        }

        return { status: "running" };
    }

    function emit(event, payload) {
        const handlers = _listeners.get(event);
        if (!handlers) return;
        handlers.forEach(fn => fn(payload));
    }

    function on(event, handler) {
        if (!event || typeof handler !== 'function') return;
        const handlers = _listeners.get(event) || new Set();
        handlers.add(handler);
        _listeners.set(event, handlers);
        return () => off(event, handler);
    }

    function off(event, handler) {
        const handlers = _listeners.get(event);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) {
            _listeners.delete(event);
        }
    }

    return {
        _state: state,
        getState: () => state,
        getSimulation: () => state.simulation,
        getUIState: () => state.ui,
        emit,
        on,
        off,
        step,
        isRunning: () => running && state.ui.isRunning,

        // UI state setters
        setActiveTool(tool) {
            state.ui.activeTool = tool;
        },
        setSelectedNode(id) {
            state.ui.selectedNodeId = id;
        },
        setLinkSource(id) {
            state.ui.linkSourceId = id;
        },
        setHovered(hoverInfo) {
            state.ui.hovered = hoverInfo;
        },
        setRunning(value) {
            running = Boolean(value);
            state.ui.isRunning = Boolean(value);
        },
        setSoundService(soundSvc) {
            state.ui.sound = soundSvc;
        },
        setTimeScale(scale) {
            state.ui.timeScale = scale;
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
            upgradeServiceById(state, id);
        },
        setTrafficProfile(profile) {
            setTrafficProfile(state, profile);
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
        },
        
        // Sandbox API methods
        setSandboxBudget(amount) {
            state.simulation.money = amount;
        },
        setRPS(rps) {
            state.simulation.currentRPS = rps;
        },
        setTrafficDistribution(distribution) {
            state.simulation.trafficDistribution = distribution;
        },
        toggleUpkeep(enabled) {
            state.simulation.upkeepEnabled = enabled;
        },
        setBurstCount(count) {
            state.simulation.burstCount = count;
        },
        clearAllServices() {
            const sim = state.simulation;
            // Remove all services
            while (sim.services.length > 0) {
                deleteObject(state, sim.services[0].id);
            }
            // Clear all requests
            sim.requests.length = 0;
            // Reset metrics
            sim.metrics.droppedByReason = {};
            sim.score = { total: 0, web: 0, api: 0, fraudBlocked: 0 };
        }
    };
}
