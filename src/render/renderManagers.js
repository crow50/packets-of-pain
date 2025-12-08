import * as serviceManager from "./serviceManager.js";
import * as connectionManager from "./connectionManager.js";
import * as requestManager from "./requestManager.js";

let engineRef = null;

export function initRenderManagers(engine) {
    engineRef = engine;
    serviceManager.init(engine);
    connectionManager.init(engine);
    requestManager.init(engine);
}

export function disposeRenderManagers() {
    serviceManager.dispose();
    connectionManager.dispose();
    requestManager.dispose();
    engineRef = null;
}

export function syncRenderState() {
    if (!engineRef) return;
    const state = engineRef.getState?.();
    if (!state) return;
    serviceManager.syncServices(state);
    connectionManager.syncConnections(state);
    requestManager.syncRequests(state);
}
