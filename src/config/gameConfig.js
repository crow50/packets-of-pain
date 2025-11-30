/**
 * gameConfig.js - Game configuration settings
 * 
 * Contains visual settings (colors), grid settings, and gameplay parameters.
 * Loaded as a regular script before other game files.
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
    packetIncreaseInterval: 0.1,
    gridSize: 30,
    tileSize: 4,
    colors: {
        bg: 0x050505,
        grid: 0x1a1a1a,
        loadBalancer: 0x3b82f6,
        compute: 0xf97316,
        database: 0xdc2626,
        waf: 0xa855f7,
        objectStorage: 0x10b981,
        line: 0x475569,
        lineActive: 0x38bdf8,
        requestWeb: 0x4ade80,    // Green
        requestApi: 0xffa500,    // Orange
        requestFraud: 0xff00ff,  // Pink
        requestFail: 0xef4444
    },
    survival: {
        startBudget: 2000,
        baseRPS: 0.5,
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
    },
    sandbox: {
        defaultBudget: 5000,
        defaultRPS: 1.0,
        burstCount: 10,
        trafficDistribution: {
            [TRAFFIC_TYPES.WEB]: 0.50,
            [TRAFFIC_TYPES.API]: 0.40,
            [TRAFFIC_TYPES.FRAUD]: 0.10
        },
        presets: {
            balanced: {
                name: 'Balanced',
                rps: 1.0,
                distribution: { [TRAFFIC_TYPES.WEB]: 0.50, [TRAFFIC_TYPES.API]: 0.40, [TRAFFIC_TYPES.FRAUD]: 0.10 }
            },
            highLoad: {
                name: 'High Load',
                rps: 3.0,
                distribution: { [TRAFFIC_TYPES.WEB]: 0.50, [TRAFFIC_TYPES.API]: 0.45, [TRAFFIC_TYPES.FRAUD]: 0.05 }
            },
            fraudAttack: {
                name: 'Fraud Attack',
                rps: 2.0,
                distribution: { [TRAFFIC_TYPES.WEB]: 0.20, [TRAFFIC_TYPES.API]: 0.20, [TRAFFIC_TYPES.FRAUD]: 0.60 }
            },
            apiHeavy: {
                name: 'API Heavy',
                rps: 1.5,
                distribution: { [TRAFFIC_TYPES.WEB]: 0.20, [TRAFFIC_TYPES.API]: 0.70, [TRAFFIC_TYPES.FRAUD]: 0.10 }
            },
            webHeavy: {
                name: 'Web Heavy',
                rps: 1.5,
                distribution: { [TRAFFIC_TYPES.WEB]: 0.70, [TRAFFIC_TYPES.API]: 0.20, [TRAFFIC_TYPES.FRAUD]: 0.10 }
            }
        }
    }
};

// Expose globally
if (typeof window !== 'undefined') {
    window.TRAFFIC_TYPES = TRAFFIC_TYPES;
    window.CONFIG = CONFIG;
    
    // Also expose via GameConfig namespace for cleaner access
    window.GameConfig = {
        TRAFFIC_TYPES,
        CONFIG
    };
}
