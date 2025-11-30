import { CAMPAIGN_LEVELS } from "../campaign/index.js";
import { DDOS_MITIGATION_SCENARIOS } from "./ddos-mitigation.js";
import { LOAD_BALANCING_SCENARIOS } from "./load-balancing.js";
import { TRAFFIC_SHAPING_SCENARIOS } from "./traffic-shaping.js";

const SAMPLE_LEVEL = CAMPAIGN_LEVELS.find(Boolean) || {};
const SHARED_ARRAY_FIELDS = ["toolbarWhitelist", "preplacedNodes", "instructions"].filter(field => field in SAMPLE_LEVEL);

function applySharedDefaults(config) {
    const normalized = { ...config };
    SHARED_ARRAY_FIELDS.forEach(field => {
        if (!Array.isArray(normalized[field])) {
            normalized[field] = [];
        }
    });
    if (!normalized.tutorial) {
        normalized.tutorial = { enabled: false, steps: [] };
    } else if (!Array.isArray(normalized.tutorial.steps)) {
        normalized.tutorial.steps = [];
    }
    if (!normalized.trafficProfile) {
        normalized.trafficProfile = {};
    }
    return normalized;
}

export const SCENARIOS = [
    ...DDOS_MITIGATION_SCENARIOS,
    ...LOAD_BALANCING_SCENARIOS,
    ...TRAFFIC_SHAPING_SCENARIOS
].map(applySharedDefaults);

const SCENARIO_CACHE = new Map(SCENARIOS.map(entry => [entry.id, entry]));

export function getScenarioById(id) {
    return SCENARIO_CACHE.get(id) || null;
}

export function getAllScenarios() {
    return [...SCENARIOS];
}
