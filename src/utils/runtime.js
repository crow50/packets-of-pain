let currentEngine = null;
let currentRuntime = null;

export function setRuntimeEngine(engine) {
    currentEngine = engine || null;
}

export function clearRuntimeEngine() {
    currentEngine = null;
}

export function getRuntimeEngine() {
    return currentEngine;
}

export function setRuntime(runtime) {
    currentRuntime = runtime || null;
}

export function getRuntime() {
    return currentRuntime;
}
