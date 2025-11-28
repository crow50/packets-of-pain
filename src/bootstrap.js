import { initGame, resetGame, startSandbox } from "./gameCore.js";
import { createEngine } from "./core/engine.js";
import { createLoop } from "./core/loop.js";
import {
    initScene,
    disposeScene,
    resetCamera,
    linkInternetMesh,
    scene,
    camera,
    renderer
} from "./render/scene.js";
import { initInteractions, updateTooltip } from "./render/interactions.js";
import { updateSimulationHud, showGameOverModal } from "./ui/hudController.js";
import { createInputController } from "./ui/inputController.js";
import { GAME_MODES, startCampaign, startCampaignLevel } from "./ui/campaign.js";

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

function buildEngineConfig(modeConfig) {
    const isCampaign = modeConfig.mode === GAME_MODES.CAMPAIGN;
    const initialTimeScale = typeof modeConfig.initialTimeScale === "number" ? modeConfig.initialTimeScale : 0;
    return {
        mode: modeConfig.mode || GAME_MODES.SANDBOX,
        startBudget: isCampaign ? 0 : CONFIG.survival.startBudget,
        startReputation: 100,
        baseRPS: CONFIG.survival.baseRPS,
        initialTimeScale,
        trafficProfile: modeConfig.trafficProfile || null
    };
}

function hydrateModeState(modeConfig) {
    if (!modeConfig) return;
    const menu = document.getElementById('main-menu-modal');
    menu?.classList.add('hidden');

    if (modeConfig.mode === GAME_MODES.CAMPAIGN) {
        resetGame('campaign');
        if (modeConfig.levelId) {
            startCampaignLevel(modeConfig.levelId);
        }
    } else {
        resetGame('survival');
    }
}

function createRuntime() {
    return {
        current: null,
        startMode(modeConfig = {}) {
            this.stop();

            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Missing #canvas-container element');
            }

            initScene(container);
            initInteractions();
            resetCamera();

            const engineConfig = buildEngineConfig(modeConfig);
            const engine = createEngine(engineConfig);
            
            // Link the internet mesh to engine's internetNode after both exist
            linkInternetMesh(engine.getSimulation()?.internetNode);
            
            engine.setRunning(true);
            const input = createInputController({ container });
            const loop = createLoop({
                engine,
                render: renderScene,
                afterFrame: (stepResult) => handleFrameSideEffects(engine, stepResult)
            });

            loop.start();

            this.current = { engine, loop, input, modeConfig };
            return this.current;
        },
        stop() {
            if (!this.current) return;
            this.current.loop.stop();
            this.current.input.detach();
            disposeScene();
            this.current = null;
        },
        restartCurrentMode() {
            if (!this.current) return null;
            const modeConfig = this.current.modeConfig;
            this.startMode(modeConfig);
            return modeConfig;
        }
    };
}

export function bootstrap() {
    initGame();
    const runtime = createRuntime();

    window.__POP_RUNTIME__ = runtime;

    function popStartSandbox() {
        startSandbox();
        const modeConfig = { mode: GAME_MODES.SANDBOX };
        runtime.startMode(modeConfig);
        hydrateModeState(modeConfig);
    }

    function popStartCampaignLevel(levelId) {
        const modeConfig = { mode: GAME_MODES.CAMPAIGN, levelId };
        runtime.startMode(modeConfig);
        hydrateModeState(modeConfig);
    }

    window.POP = {
        startSandbox: popStartSandbox,
        startCampaign() {
            startCampaign();
        },
        startCampaignLevel: popStartCampaignLevel,
        restartCurrentMode() {
            const modeConfig = runtime.restartCurrentMode();
            if (modeConfig) {
                hydrateModeState(modeConfig);
            }
        }
    };

    // Backward compatibility for inline handlers
    window.startSandbox = () => window.POP.startSandbox();
    window.startCampaign = () => window.POP.startCampaign();
    window.startCampaignLevel = (levelId) => window.POP.startCampaignLevel(levelId);

    return runtime;
}
