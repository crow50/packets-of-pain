/**
 * Mode Manager
 * Centralizes mode switching lifecycle, emits events, and ensures proper teardown.
 */

import { GAME_MODES } from "../modes/constants.js";
import { getModeController } from "../modes/index.js";

let _runtime = null;
let _currentMode = null;
let _currentController = null;

/**
 * Initialize the mode manager with the runtime reference.
 * @param {object} runtime - The game runtime from bootstrap
 */
export function initModeManager(runtime) {
    _runtime = runtime;
    _currentMode = null;
    _currentController = null;
}

/**
 * Get the currently active mode ID.
 * @returns {string|null}
 */
export function getActiveMode() {
    return _currentMode;
}

/**
 * Get the current mode controller instance.
 * @returns {object|null}
 */
export function getCurrentController() {
    return _currentController;
}

/**
 * Switch to a new game mode.
 * Tears down the previous mode controller and initializes the new one.
 * Emits `pop-mode:modeChanged` event on the engine.
 *
 * @param {string} modeId - The mode to switch to (from GAME_MODES)
 * @param {object} config - Mode-specific configuration
 * @returns {object|null} The new runtime session or null if failed
 */
export function switchToMode(modeId, config = {}) {
    if (!_runtime) {
        console.error("[ModeManager] Runtime not initialized. Call initModeManager first.");
        return null;
    }

    const previousMode = _currentMode;
    const previousController = _currentController;

    // Resolve mode ID
    const resolvedMode = modeId || GAME_MODES.SANDBOX;
    const modeConfig = { ...config, mode: resolvedMode };

    // Start the new mode via runtime (handles teardown internally)
    const session = _runtime.startMode(modeConfig);
    if (!session) {
        return null;
    }

    // Update internal tracking
    _currentMode = resolvedMode;
    _currentController = session.controller;

    // Emit mode changed event
    const engine = session.engine;
    if (engine?.emit) {
        engine.emit("pop-mode:modeChanged", {
            previousMode,
            newMode: resolvedMode,
            config: modeConfig
        });
    }

    return session;
}

/**
 * Restart the current mode with its existing configuration.
 * @returns {object|null} The new runtime session or null if no mode active
 */
export function restartCurrentMode() {
    if (!_runtime?.current) {
        return null;
    }
    const modeConfig = _runtime.current.modeConfig;
    return switchToMode(modeConfig.mode, modeConfig);
}

/**
 * Stop the current mode and return to an idle state.
 */
export function stopCurrentMode() {
    if (!_runtime) return;
    _runtime.stop();
    _currentMode = null;
    _currentController = null;
}

/**
 * Teardown the mode manager (clears references).
 */
export function teardownModeManager() {
    _runtime = null;
    _currentMode = null;
    _currentController = null;
}
