const MAX_FRAME_STEP = 0.1; // prevent spiral of death when tab is inactive
const FIXED_STEP = 1 / 60;

export function createLoop({ engine, render, afterFrame }) {
    if (!engine) {
        throw new Error("createLoop requires an engine instance");
    }
    if (typeof render !== "function") {
        throw new Error("createLoop requires a render function");
    }

    let running = false;
    let lastTime = null;
    let accumulator = 0;

    let lastStepResult = null;

    function frame(timestamp) {
        if (!running) return;

        if (lastTime == null) {
            lastTime = timestamp;
        }

        let deltaSeconds = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        deltaSeconds = Math.min(deltaSeconds, MAX_FRAME_STEP);
        accumulator += deltaSeconds;

        while (accumulator >= FIXED_STEP) {
            lastStepResult = engine.step(FIXED_STEP);
            accumulator -= FIXED_STEP;
        }

        if (typeof afterFrame === "function") {
            afterFrame(lastStepResult);
        }

        render();
        requestAnimationFrame(frame);
    }

    return {
        start() {
            if (running) return;
            running = true;
            lastTime = null;
            accumulator = 0;
            requestAnimationFrame(frame);
        },
        stop() {
            running = false;
        },
        isRunning() {
            return running;
        }
    };
}
