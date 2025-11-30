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
import { initInteractions, updateTooltip, init as initInteractionsModule } from "./render/interactions.js";
import { initRenderManagers, disposeRenderManagers, syncRenderState } from "./render/renderManagers.js";
import { updateSimulationHud, showGameOverModal, init as initHudController } from "./ui/hudController.js";
import { initToolSync, disposeToolSync } from "./ui/toolSync.js";
import { createInputController, init as initInputController } from "./ui/inputController.js";
import { GAME_MODES, startCampaign, startCampaignLevel } from "./ui/campaign.js";
import { getLevelById } from "./config/campaign/index.js";
import { initHudMenu } from "./ui/menuController.js";
import { initTimeControls } from "./ui/timeControls.js";
import { initSandboxControls } from "./ui/sandboxController.js";
import { initWarningsPill } from "./ui/hud.js";
import { updateTutorial } from "./ui/tutorialController.js";
import { initLevelConditions, disposeLevelConditions, updateLevelConditions } from "./ui/levelConditions.js";

function renderScene() {
    syncRenderState();
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
}

function handleFrameSideEffects(engine, stepResult) {
    updateSimulationHud(engine.getState());
    updateTooltip();
    updateTutorial(engine);
    updateLevelConditions(engine);

    if (stepResult?.status === "gameover" && stepResult.failure) {
        showGameOverModal(stepResult.failure);
    }
}

const DEFAULT_INTERNET_POSITION = { x: -10, y: 0, z: 0 };

function buildEngineConfig(modeConfig) {
    const isCampaign = modeConfig.mode === GAME_MODES.CAMPAIGN;
    const isSandbox = modeConfig.mode === GAME_MODES.SANDBOX;
    const initialTimeScale = typeof modeConfig.initialTimeScale === "number" ? modeConfig.initialTimeScale : 0;
    
    const baseConfig = {
        mode: modeConfig.mode || GAME_MODES.SANDBOX,
        startBudget: isCampaign ? 0 : (isSandbox ? CONFIG.sandbox.defaultBudget : CONFIG.survival.startBudget),
        startReputation: 100,
        baseRPS: isSandbox ? CONFIG.sandbox.defaultRPS : CONFIG.survival.baseRPS,
        initialTimeScale,
        trafficProfile: modeConfig.trafficProfile || null
    };
    
    // Add sandbox-specific config
    if (isSandbox) {
        baseConfig.upkeepEnabled = false;
        baseConfig.trafficDistribution = CONFIG.sandbox.trafficDistribution;
        baseConfig.burstCount = CONFIG.sandbox.burstCount;
    }

    const levelConfig = modeConfig.levelId ? getLevelById(modeConfig.levelId) : null;
    const internetPosition = modeConfig.internetPosition || levelConfig?.internetPosition || DEFAULT_INTERNET_POSITION;
    baseConfig.internetPosition = { ...internetPosition };
    
    return baseConfig;
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
            
            // Use shared sound service from menu (preserves mute state)
            if (window.__menuSound) {
                engine.setSoundService(window.__menuSound);
            }
            
            // Initialize modules with engine reference (removes global reach-through)
            initInteractionsModule(engine);
            initHudController(engine);
            initInputController(engine);
            initSandboxControls(engine); // Initialize sandbox controls (shows panel only in sandbox mode)
            initRenderManagers(engine);
            initToolSync(engine);
            initLevelConditions(engine);
            
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
            disposeToolSync();
            disposeRenderManagers();
            disposeScene();
            this.current = null;
            disposeLevelConditions();
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
    initHudMenu(); // Initialize hamburger menu
    initWarningsPill();
    initTimeControls();
    const runtime = createRuntime();

    window.__POP_RUNTIME__ = runtime;

    function popStartSandbox() {
        startSandbox();
        const modeConfig = {
            mode: GAME_MODES.SANDBOX,
            internetPosition: DEFAULT_INTERNET_POSITION
        };
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
