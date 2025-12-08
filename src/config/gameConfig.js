/**
 * gameConfig.js - Game configuration settings
 * 
 * Contains visual settings (colors), grid settings, and gameplay parameters.
 * Loaded as a regular script before other game files.
 * 
 * NOTE: Traffic class enums have moved to packetConfig.js
 * This file now references TRAFFIC_CLASS from that module.
 */

export const CONFIG = {
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
        lineActive: 0x38bdf8
        // Packet colors moved to packetConfig.js (PACKET_COLORS, PACKET_FAIL_COLOR)
    },
    survival: {
        startBudget: 2000,
        baseRPS: 0.5,
        trafficDistribution: {
            WEB: 0.50,
            API: 0.45,
            FRAUD: 0.05
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
            WEB: 0.50,
            API: 0.40,
            FRAUD: 0.10
        },
        presets: {
            balanced: {
                name: 'Balanced',
                rps: 1.0,
                distribution: { WEB: 0.50, API: 0.40, FRAUD: 0.10 }
            },
            highLoad: {
                name: 'High Load',
                rps: 3.0,
                distribution: { WEB: 0.50, API: 0.45, FRAUD: 0.05 }
            },
            fraudAttack: {
                name: 'Fraud Attack',
                rps: 2.0,
                distribution: { WEB: 0.20, API: 0.20, FRAUD: 0.60 }
            },
            apiHeavy: {
                name: 'API Heavy',
                rps: 1.5,
                distribution: { WEB: 0.20, API: 0.70, FRAUD: 0.10 }
            },
            webHeavy: {
                name: 'Web Heavy',
                rps: 1.5,
                distribution: { WEB: 0.70, API: 0.20, FRAUD: 0.10 }
            }
        }
    }
};

export default CONFIG;
