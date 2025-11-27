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

function evaluateFailure(state) {
    if (!state) return null;
    if (state.reputation <= 0) {
        return { type: "reputation", ...FAILURE_COPY.reputation };
    }
    if (state.money <= -1000) {
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

function deleteLinkById(linkId) {
    const target = (STATE.connections || []).find(link => link.id === linkId);
    if (target) {
        removeLink(target);
    }
}

function upgradeServiceById(serviceId) {
    const svc = (STATE.services || []).find(service => service.id === serviceId);
    if (svc && typeof svc.upgrade === "function") {
        svc.upgrade();
    }
}

export function createEngine() {
    let running = true;

    function step(deltaSeconds) {
        if (!running || !STATE.isRunning) {
            return { status: STATE.isRunning ? "paused" : "stopped" };
        }

        gameTick(deltaSeconds);
        const failure = evaluateFailure(STATE);
        if (failure) {
            running = false;
            STATE.isRunning = false;
            return { status: "gameover", failure };
        }

        return { status: "running" };
    }

    return {
        getState: () => STATE,
        step,
        isRunning: () => running && STATE.isRunning,
        setRunning(value) {
            running = Boolean(value);
            STATE.isRunning = Boolean(value);
        },
        placeService(type, position) {
            if (!type) return;
            createService(type, asVector(position));
        },
        connectNodes(fromId, toId) {
            createConnection(fromId, toId);
        },
        deleteNode(id) {
            deleteObject(id);
        },
        deleteLink(linkId) {
            deleteLinkById(linkId);
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
            return {
                reputation: STATE.reputation,
                budget: STATE.money,
                processedByType: {
                    WEB: STATE.score?.web ?? 0,
                    API: STATE.score?.api ?? 0,
                    FRAUD: STATE.score?.fraudBlocked ?? 0
                },
                blockedByType: {
                    FRAUD: STATE.score?.fraudBlocked ?? 0
                },
                droppedByReason: STATE.metrics?.droppedByReason ?? {}
            };
        },
        getFailureCopy(reasonType) {
            return FAILURE_COPY[reasonType] || null;
        }
    };
}
