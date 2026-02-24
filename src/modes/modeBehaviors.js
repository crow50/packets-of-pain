const DEFAULT_BEHAVIORS = {
    pickTrafficSource: null,
    shouldAllowGameOver: () => true
};

let activeBehaviors = { ...DEFAULT_BEHAVIORS };

export function setModeBehaviors(overrides = {}) {
    activeBehaviors = { ...DEFAULT_BEHAVIORS, ...overrides };
}

export function resetModeBehaviors() {
    activeBehaviors = { ...DEFAULT_BEHAVIORS };
}

export function getModeBehaviors() {
    return activeBehaviors;
}
