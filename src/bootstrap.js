import { initGame } from "./gameCore.js";
import { createEngine } from "./core/engine.js";
import { createLoop } from "./core/loop.js";
import { scene, camera, renderer } from "./render/scene.js";
import { updateTooltip } from "./render/interactions.js";
import { updateSimulationHud, showGameOverModal } from "./ui/hudController.js";

function renderScene() {
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
}

function handleFrameSideEffects(engine, stepResult) {
    updateSimulationHud(engine.getState());
    updateTooltip();

    if (stepResult?.status === "gameover" && stepResult.failure) {
        showGameOverModal(stepResult.failure);
    }
}

export function bootstrap() {
    initGame();
    const engine = createEngine();
    engine.setRunning(true);

    const loop = createLoop({
        engine,
        render: renderScene,
        afterFrame: (stepResult) => handleFrameSideEffects(engine, stepResult)
    });

    loop.start();

    const runtime = { engine, loop };
    window.__POP_RUNTIME__ = runtime;
    return runtime;
}
