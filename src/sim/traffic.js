/**
 * traffic.js - Core packet lifecycle management
 * 
 * This module handles the COMPLETE packet lifecycle from spawn to termination.
 * Uses TRAFFIC_CLASS and PACKET_PHASE from packetConfig.js for packet creation.
 * 
 * RESPONSIBILITIES:
 * - Packet spawning (spawnRequest, spawnBurstOfType)
 * - Traffic class selection based on distribution (getTrafficType)
 * - Response packet generation (spawnInboundResponse)
 * - Initial routing to first hop (routeInitialRequest)
 * - Score and reputation updates (updateScore, finishRequest, failRequest)
 * - Packet removal and cleanup (removeRequest)
 * - Game tick processing (gameTick)
 * 
 * NOT RESPONSIBLE FOR (see trafficBehaviors.js instead):
 * - Mode-specific source selection logic
 * - User node selection algorithms
 * - Traffic profile interpretation for source selection
 * 
 * @module traffic
 * 
 * @test Packets should spawn with correct trafficClass from distribution
 * @test Response packets should have phase=RESPONSE and correct trafficClass
 * @test Failed packets should update reputation appropriately
 * @test Completed packets should trigger response generation for WEB/API from users
 */

import Request from "../entities/Request.js";
import { toPlainPosition } from "./vectorUtils.js";
import { getModeBehaviors } from "../modes/modeBehaviors.js";
import { TRAFFIC_CLASS, PACKET_PHASE } from "../config/packetConfig.js";
import { listConnections } from "./connectionUtils.js";
import { getServiceDef } from "../config/serviceCatalog.js";
import { CONFIG } from "../config/gameConfig.js";
import { getRuntimeEngine } from "../utils/runtime.js";

let trafficEngine = null;
export function attachTrafficEngine(engine) {
    trafficEngine = engine;
}

function getEngine() {
    return trafficEngine || getRuntimeEngine();
}

function getServiceDefinition(node) {
    if (!node) return null;
    return getServiceDef(node.kind);
}

/**
 * Check if a node accepts a specific traffic class
 * @param {Object} node - Service node
 * @param {string} trafficClass - TRAFFIC_CLASS value
 * @returns {boolean}
 */
function nodeAcceptsTraffic(node, trafficClass) {
    const def = getServiceDefinition(node);
    if (!def) return false;
    const acceptsList = def.acceptsClasses;
    if (!Array.isArray(acceptsList)) return false;
    return acceptsList.includes(trafficClass);
}

function pickPreferredEntryNode(nodes, trafficClass) {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    const accepting = nodes.filter(node => nodeAcceptsTraffic(node, trafficClass));
    const pool = accepting.length ? accepting : nodes;
    return pool[Math.floor(Math.random() * pool.length)] || null;
}

function resolveState(arg) {
    if (arg && (arg.simulation || arg.ui)) return arg;
    const engine = getEngine();
    return engine ? engine.getState() : null;
}

function emitEvent(event, payload) {
    const engine = getEngine();
    engine?.emit?.(event, payload);
}

/**
 * Select the source node for a new packet
 * 
 * Delegates to mode-specific behavior hooks (trafficBehaviors.js) for source selection.
 * This is the integration point between core lifecycle (traffic.js) and mode-specific
 * source selection (trafficBehaviors.js).
 * 
 * @param {Object} sim - Simulation state
 * @param {Object} trafficProfile - Traffic profile with rate settings
 * @returns {Object} { source: node, fromUser: boolean }
 * 
 * @test Should return internet node when trafficProfile.inboundOnly is true
 * @test Should delegate to mode behaviors when pickTrafficSource is defined
 * @test Should fall back to internet node when no custom behavior returns a source
 */
function pickRequestSource(sim, trafficProfile) {
    const defaultSource = sim.internetNode;
    const defaultResult = { source: defaultSource, fromUser: false };
    if (trafficProfile?.inboundOnly) {
        return defaultResult;
    }

    const behaviors = getModeBehaviors();
    if (typeof behaviors.pickTrafficSource === 'function') {
        const custom = behaviors.pickTrafficSource({
            sim,
            trafficProfile,
            defaultResult
        });
        if (custom && custom.source) {
            return custom;
        }
    }

    return defaultResult;
}

/**
 * Route a newly spawned request to its first hop
 * 
 * @param {Object} state - Game state
 * @param {Object} req - Request entity with trafficClass
 * @param {Object} sourceNode - Node spawning the request (usually internet)
 */
function routeInitialRequest(state, req, sourceNode) {
    const sim = state.simulation || state;
    const origin = sourceNode || sim.internetNode;
    if (!origin) {
        failRequest(state, req);
        return;
    }

    const connectionList = origin === sim.internetNode
        ? listConnections(sim.internetNode)
        : listConnections(origin);

    if (!connectionList.length) {
        failRequest(state, req);
        return;
    }

    const entryNodes = connectionList
        .map(conn => conn.targetId === 'internet' ? sim.internetNode : sim.services.find(s => s.id === conn.targetId))
        .filter(Boolean);

    if (!entryNodes.length) {
        failRequest(state, req);
        return;
    }

    const getNodeKind = (node) => node?.kind;
    const trafficClass = req.trafficClass;

    let target = null;
    if (origin === sim.internetNode) {
        const wafEntry = entryNodes.find(s => s && getNodeKind(s) === 'WAF');
        target = wafEntry || entryNodes[Math.floor(Math.random() * entryNodes.length)];
    } else {
        target = entryNodes[Math.floor(Math.random() * entryNodes.length)];
    }

    if (origin === sim.internetNode) {
        const nonUserNodes = entryNodes.filter(node => getNodeKind(node) !== 'user');
        const pool = nonUserNodes.length ? nonUserNodes : entryNodes;
        target = pickPreferredEntryNode(pool, trafficClass);
    } else {
        target = entryNodes[Math.floor(Math.random() * entryNodes.length)] || null;
    }

    if (!target) {
        failRequest(state, req);
        return;
    }

    req.lastNodeId = origin?.id || 'internet';
    req.flyTo(target);
}

/**
 * Spawn a response packet going back to the user
 * 
 * Uses PACKET_PHASE.RESPONSE instead of legacy INBOUND traffic type.
 * The response keeps the original trafficClass but changes phase.
 * 
 * @param {Object} state - Game state
 * @param {Object} completedRequest - The request that was successfully completed
 * 
 * @test Should only spawn responses for WEB and API traffic from users
 * @test Response should have phase=RESPONSE and same trafficClass as original
 * @test Response should have responseOrigin set with sourceId and targetUserId
 */
function spawnInboundResponse(state, completedRequest) {
    if (!completedRequest) return;
    const sim = state.simulation || state;
    
    const trafficClass = completedRequest.trafficClass;
    const allowed = trafficClass === TRAFFIC_CLASS.WEB || trafficClass === TRAFFIC_CLASS.API;
    if (!allowed || completedRequest.responseOrigin?.sourceType !== 'user') return;

    const userService = sim.services?.find(s => s.id === completedRequest.responseOrigin?.sourceId && s.kind === 'USER');
    if (!userService) return;

    // Create response packet using new model
    const responseReq = new Request(trafficClass, sim.internetNode?.position, {
        phase: PACKET_PHASE.RESPONSE,
        responseOrigin: {
            sourceId: sim.internetNode?.id || 'internet',
            targetUserId: userService.id
        }
    });
    
    // Legacy compatibility fields (set via the Request constructor options)
    responseReq.sourceType = 'internet';

    sim.requests.push(responseReq);
    emitEvent('requestSpawned', { 
        requestId: responseReq.id, 
        trafficClass: responseReq.trafficClass, 
        phase: responseReq.phase,
        from: toPlainPosition(responseReq.position) 
    });
    routeInitialRequest(state, responseReq, sim.internetNode);
}


export function updateScore(arg1, arg2, arg3) {
    // Overload: updateScore(req, outcome) OR updateScore(state, req, outcome)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;
    const outcome = hasState ? arg3 : arg2;

    const sim = state.simulation || state;

    const points = CONFIG.survival.SCORE_POINTS;
    if (req && outcome) {
        const trafficClass = req.trafficClass;
        
        switch (outcome) {
            case 'COMPLETED':
                if (trafficClass === TRAFFIC_CLASS.WEB) {
                    sim.score.web += points.WEB_SCORE;
                    sim.money += points.WEB_REWARD;
                } else if (trafficClass === TRAFFIC_CLASS.API) {
                    sim.score.api += points.API_SCORE;
                    sim.money += points.API_REWARD;
                }
                break;
            case 'FAILED':
                sim.reputation += points.FAIL_REPUTATION;
                break;
            case 'FRAUD_PASSED':
                sim.reputation += points.FRAUD_PASSED_REPUTATION;
                break;
            case 'FRAUD_BLOCKED':
                sim.score.fraudBlocked += points.FRAUD_BLOCKED_SCORE;
                break;
        }
        sim.reputation = Math.min(100, Math.max(0, sim.reputation));
        sim.score.total = sim.score.web + sim.score.api + sim.score.fraudBlocked;
    } else {
        sim.score.total = sim.score.web + sim.score.api + sim.score.fraudBlocked;
    }
}

export function removeRequest(arg1, arg2) {
    // Overload: removeRequest(req) OR removeRequest(state, req)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    if (req && typeof req.destroy === 'function') {
        req.destroy();
    }
    sim.requests = sim.requests.filter(r => r !== req);
}

export function finishRequest(arg1, arg2) {
    // Overload: finishRequest(req) OR finishRequest(state, req)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.requestsProcessed++;
    updateScore(state, req, 'COMPLETED');
    emitEvent('requestFinished', {
        requestId: req.id,
        trafficClass: req.trafficClass,
        phase: req.phase,
        responseOrigin: req.responseOrigin
    });
    spawnInboundResponse(state, req);
    removeRequest(state, req);
}

export function failRequest(arg1, arg2, arg3) {
    // Overload: failRequest(req) OR failRequest(state, req) OR failRequest(req, reason) OR failRequest(state, req, reason)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const req = hasState ? arg2 : arg1;
    const reason = hasState ? arg3 : arg2;

    const ui = state.ui || state;
    const sim = state.simulation || state;

    const trafficClass = req.trafficClass;
    const failType = trafficClass === TRAFFIC_CLASS.FRAUD ? 'FRAUD_PASSED' : 'FAILED';
    
    // Apply heavier penalty for misconfig failures
    if (reason === 'misconfig') {
        const points = CONFIG.survival.SCORE_POINTS;
        sim.reputation += (points.FAIL_REPUTATION || -2) * 2; // Double penalty
        sim.reputation = Math.min(100, Math.max(0, sim.reputation));
    } else {
        updateScore(state, req, failType);
    }
    
    ui.sound?.playFail?.();
    emitEvent('requestFailed', { requestId: req.id, reason: reason || 'unknown' });
    setTimeout(() => removeRequest(state, req), 500);
}

export function calculateFailChanceBasedOnLoad(load) {
    const clamped = Math.max(0, Math.min(1, load));
    if (clamped <= 0.8) return 0;
    return (clamped - 0.8) / 0.2;
}

/**
 * Select a traffic class based on distribution weights
 * 
 * @param {Object} sim - Simulation state
 * @returns {string} TRAFFIC_CLASS value (WEB, API, or FRAUD)
 * 
 * @test Distribution {WEB:0.5, API:0.4, FRAUD:0.1} should produce ~50% WEB over many samples
 * @test Distribution {WEB:0.5, API:0.4, FRAUD:0.1} should produce ~40% API over many samples
 * @test Distribution {WEB:0.5, API:0.4, FRAUD:0.1} should produce ~10% FRAUD over many samples
 * @test Should use sim.trafficDistribution when set (sandbox mode)
 * @test Should fall back to CONFIG.survival.trafficDistribution when sim.trafficDistribution is null
 * @test Should return TRAFFIC_CLASS enum values, not string literals
 */
function getTrafficType(sim) {
    const r = Math.random();
    // Use sim.trafficDistribution if set (sandbox), otherwise fall back to survival config
    const dist = sim?.trafficDistribution || CONFIG.survival.trafficDistribution;
    // Distribution uses string keys matching TRAFFIC_CLASS values
    if (r < (dist['WEB'] || dist[TRAFFIC_CLASS.WEB] || 0)) return TRAFFIC_CLASS.WEB;
    if (r < (dist['WEB'] || dist[TRAFFIC_CLASS.WEB] || 0) + (dist['API'] || dist[TRAFFIC_CLASS.API] || 0)) return TRAFFIC_CLASS.API;
    return TRAFFIC_CLASS.FRAUD;
}

/**
 * Spawn a new request packet
 * 
 * @param {Object} state - Game state
 * 
 * @test Should spawn packets with trafficClass from getTrafficType distribution
 * @test Should spawn MALICIOUS when trafficProfile.maliciousRate > 0
 * @test Inbound-only profiles should create packets with phase=RESPONSE
 * @test Inbound-only profiles should default to WEB trafficClass
 * @test Packets should have sourceId and sourceType set from source node
 * @test Packets should be added to sim.requests array
 * @test Should emit 'requestSpawned' event with trafficClass and phase
 * @test Should call routeInitialRequest to send packet to first hop
 */
function spawnRequest(state) {
    const sim = state.simulation || state;
    const ui = state.ui || state;

    let trafficClass = getTrafficType(sim);
    let phase = PACKET_PHASE.REQUEST;
    const trafficProfile = sim.trafficProfile;
    const inboundOnly = Boolean(trafficProfile?.inboundOnly);
    
    // If a traffic profile with user/malicious rates is set, use those to determine type
    // This is mode-agnostic: any mode can set a trafficProfile
    if (!inboundOnly && trafficProfile) {
        const { userToInternetPps = 0, maliciousRate = 0 } = trafficProfile;
        const total = userToInternetPps + maliciousRate;
        if (total > 0) {
            // Use MALICIOUS for malicious traffic (instead of legacy FRAUD in this context)
            const maliciousChance = maliciousRate / total;
            trafficClass = Math.random() < maliciousChance ? TRAFFIC_CLASS.MALICIOUS : TRAFFIC_CLASS.WEB;
        }
    }
    
    // Inbound-only spawns response packets going to users
    if (inboundOnly) {
        phase = PACKET_PHASE.RESPONSE;
        trafficClass = TRAFFIC_CLASS.WEB; // Default to WEB for inbound responses
    }
    
    const { source: sourceNode = sim.internetNode } = pickRequestSource(sim, trafficProfile);
    const sourcePosition = sourceNode?.position || sim.internetNode?.position;

    const req = new Request(trafficClass, sourcePosition, { phase });
    req.sourceId = sourceNode?.id || 'internet';
    req.sourceType = sourceNode?.kind || 'internet';
    sim.requests.push(req);
    emitEvent('requestSpawned', { 
        requestId: req.id, 
        trafficClass: req.trafficClass, 
        phase: req.phase,
        from: toPlainPosition(req.position) 
    });
    routeInitialRequest(state, req, sourceNode);
}

// Spawn a burst of requests of a specific trafficClass (for sandbox testing)
export function spawnBurstOfType(state, trafficClass, count) {
    const sim = state.simulation || state;
    const internetOrigin = sim.internetNode?.position;
    
    for (let i = 0; i < count; i++) {
        const req = new Request(trafficClass, internetOrigin);
        sim.requests.push(req);
        emitEvent('requestSpawned', { requestId: req.id, trafficClass: req.trafficClass, from: toPlainPosition(req.position) });
        routeInitialRequest(state, req, sim.internetNode);
    }
}

export function initTrafficForMode(arg1, arg2) {
    // Overload: initTrafficForMode(mode) OR initTrafficForMode(state, mode)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const mode = hasState ? arg2 : arg1;

    const sim = state.simulation || state;

    sim.spawnTimer = 0;
    const baseRPS = typeof sim.baseRPS === 'number' ? sim.baseRPS : CONFIG.survival.baseRPS;
    sim.currentRPS = baseRPS;
}

export function gameTick(arg1, arg2) {
    // Overload: gameTick(delta) OR gameTick(state, delta)
    const hasState = arg1 && (arg1.simulation || arg1.ui);
    const state = resolveState(arg1);
    const dt = hasState ? arg2 : arg1;

    const sim = state.simulation || state;
    const ui = state.ui || state;

    const timeScale = ui.timeScale ?? 1;
    const scaledDt = dt * timeScale;

    sim.spawnTimer += scaledDt;
    if (sim.currentRPS > 0 && sim.spawnTimer > 1 / sim.currentRPS) {
        spawnRequest(state);
        sim.spawnTimer = 0;
    }

    const packetIncreaseInterval =
        typeof sim.packetIncreaseInterval === 'number'
            ? sim.packetIncreaseInterval
            : (CONFIG?.packetIncreaseInterval ?? 0);
    // Ramp control: allow if rampRequiresUnpause is false, or if time is running
    const rampRequiresUnpause = sim.rampRequiresUnpause ?? true;
    const allowRamp = !rampRequiresUnpause || (ui.timeScale ?? 0) >= 1;
    if (packetIncreaseInterval > 0 && allowRamp) {
        sim.currentRPS = Math.max(0, sim.currentRPS + packetIncreaseInterval * scaledDt);
    }

    const profileRamp = sim.trafficProfile?.rpsRampPerSecond ?? 0;
    if (profileRamp) {
        sim.currentRPS = Math.max(0, sim.currentRPS + profileRamp * scaledDt);
    }

    sim.services.forEach(s => s.update(scaledDt));
    sim.requests.forEach(r => r.update(scaledDt));
}
