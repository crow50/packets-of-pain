/**
 * config.js - Global configuration (loaded as a regular script for backward compatibility)
 * 
 * NOTE: For new code, import from config/serviceCatalog.js directly for service definitions.
 * This file maintains the legacy CONFIG and TRAFFIC_TYPES globals.
 */

const TRAFFIC_TYPES = {
    WEB: 'WEB',
    API: 'API',
    FRAUD: 'FRAUD',
    MALICIOUS: 'MALICIOUS',
    OUTBOUND: 'OUTBOUND',
    INBOUND: 'INBOUND',
    REQUEST: 'REQUEST',
    RESPONSE: 'RESPONSE'
};

const CONFIG = {
    gridSize: 30,
    tileSize: 4,
    colors: {
        bg: 0x050505, grid: 0x1a1a1a,
        loadBalancer: 0x3b82f6, compute: 0xf97316,
        database: 0xdc2626, waf: 0xa855f7,
        objectStorage: 0x10b981, line: 0x475569,
        lineActive: 0x38bdf8,
        requestWeb: 0x4ade80, // Green
        requestApi: 0xffa500, // Orange
        requestFraud: 0xff00ff, // Pink
        requestFail: 0xef4444
    },
    survival: {
        startBudget: 2000,
        baseRPS: 0.5,
        rampUp: 0.025,
        trafficDistribution: {
            [TRAFFIC_TYPES.WEB]: 0.50,
            [TRAFFIC_TYPES.API]: 0.45,
            [TRAFFIC_TYPES.FRAUD]: 0.05
        },

        SCORE_POINTS: {
            WEB_SCORE: 5,
            API_SCORE: 5,
            WEB_REWARD: 1.5,
            API_REWARD: 1.4,
            FAIL_REPUTATION: -2.5,
            FRAUD_PASSED_REPUTATION: -5,
            FRAUD_BLOCKED_SCORE: 5
        }
    }
};
