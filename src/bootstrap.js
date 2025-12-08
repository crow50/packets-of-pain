import { initGame, resetSimulationState } from "./gameCore.js";
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
import { updateSimulationHud, init as initHudController } from "./ui/hudController.js";
import { initToolSync, disposeToolSync } from "./ui/toolSync.js";
import { createInputController, init as initInputController } from "./ui/inputController.js";
import { initCampaignControls, initCampaignHubControls, startCampaign } from "./ui/campaign.js";
import { getLevelById } from "./config/campaign/index.js";
import { getScenarioById } from "./config/scenarios/index.js";
import { initHudMenu, initMainMenuButtons } from "./ui/menuController.js";
import { initTimeControls } from "./ui/timeControls.js";
import { initSandboxControls } from "./ui/sandboxController.js";
import { initWarningsPill } from "./ui/hud.js";
import { initTutorialController, updateTutorial } from "./ui/tutorialController.js";
import { initLevelConditions, disposeLevelConditions, updateLevelConditions } from "./ui/levelConditions.js";
import { initToolbarController } from "./ui/toolbarController.js";
import { GAME_MODES } from "./modes/constants.js";
import { getModeController } from "./modes/index.js";
import { initScenariosController } from "./ui/scenariosController.js";
import { init as initGameOverController, teardown as teardownGameOverController } from "./ui/gameOverController.js";
import { initModeManager, switchToMode, restartCurrentMode as mgrRestartCurrentMode, teardownModeManager } from "./core/modeManager.js";
import { initSpanningTreeManager } from "./sim/spanningTree.js";
import { CONFIG } from "./config/gameConfig.js";
import { attachToolsEngine } from "./sim/tools.js";
import { attachEconomyEngine } from "./sim/economy.js";
import { attachTrafficEngine } from "./sim/traffic.js";
import { setRuntimeEngine, clearRuntimeEngine, setRuntime as setRuntimeHandle } from "./utils/runtime.js";
import { getMenuSound } from "./gameCore.js";

function renderScene() {
    syncRenderState();
    if (!renderer || !scene || !camera) return;
    renderer.render(scene, camera);
}

function handleFrameSideEffects(engine, stepResult, controller, modeConfig) {
    updateSimulationHud(engine.getState());
    updateTooltip();
    updateTutorial(engine);
    updateLevelConditions(engine);

    controller?.onTick?.({ engine, stepResult, modeConfig });

    if (stepResult?.status === "gameover" && stepResult.failure) {
        engine.emit("pop-mode:gameOver", { failure: stepResult.failure, modeConfig });
        controller?.onGameOver?.({ engine, failure: stepResult.failure, modeConfig });
    }
}

const DEFAULT_INTERNET_POSITION = { x: -10, y: 0, z: 0 };

function buildEngineConfig(modeConfig) {
    const isCampaign = modeConfig.mode === GAME_MODES.CAMPAIGN;
    const isSandbox = modeConfig.mode === GAME_MODES.SANDBOX;
    const initialTimeScale = typeof modeConfig.initialTimeScale === "number" ? modeConfig.initialTimeScale : 0;
    const levelConfig = modeConfig.levelId ? getLevelById(modeConfig.levelId) : null;
    
    const explicitBudget = typeof modeConfig.startBudget === "number" ? modeConfig.startBudget : null;
    const explicitBaseRPS = typeof modeConfig.baseRPS === "number" ? modeConfig.baseRPS : null;

    const baseConfig = {
        mode: modeConfig.mode || GAME_MODES.SANDBOX,
        startBudget: explicitBudget !== null
            ? explicitBudget
            : (isCampaign ? 0 : (isSandbox ? CONFIG.sandbox.defaultBudget : CONFIG.survival.startBudget)),
        startReputation: 100,
        baseRPS: explicitBaseRPS !== null
            ? explicitBaseRPS
            : (isSandbox ? CONFIG.sandbox.defaultRPS : CONFIG.survival.baseRPS),
        initialTimeScale,
        trafficProfile: modeConfig.trafficProfile || null
    };

    const packetIncreaseInterval = (typeof modeConfig.packetIncreaseInterval === 'number')
        ? modeConfig.packetIncreaseInterval
        : (typeof levelConfig?.packetIncreaseInterval === 'number'
            ? levelConfig.packetIncreaseInterval
            : CONFIG.packetIncreaseInterval);

    baseConfig.packetIncreaseInterval = packetIncreaseInterval;
    
    // Add sandbox-specific config
    if (isSandbox) {
        baseConfig.upkeepEnabled = false;
        baseConfig.trafficDistribution = CONFIG.sandbox.trafficDistribution;
        baseConfig.burstCount = CONFIG.sandbox.burstCount;
    }

    const internetPosition = modeConfig.internetPosition || levelConfig?.internetPosition || DEFAULT_INTERNET_POSITION;
    baseConfig.internetPosition = { ...internetPosition };
    
    return baseConfig;
}

function createRuntime() {
    return {
        current: null,
        startMode(modeConfig = {}) {
            this.stop();
            const resolvedMode = modeConfig.mode || GAME_MODES.SANDBOX;
            const controller = getModeController(resolvedMode);
            const normalizedConfig = { ...modeConfig, mode: resolvedMode };

            const container = document.getElementById('canvas-container');
            if (!container) {
                throw new Error('Missing #canvas-container element');
            }

            const menu = document.getElementById('main-menu-modal');
            menu?.classList.add('hidden');

            initScene(container);
            initInteractions();
            resetCamera();

            const engineConfig = buildEngineConfig(normalizedConfig);
            const engine = createEngine({ ...engineConfig, resetSimulationState });
            attachToolsEngine(engine);
            attachEconomyEngine(engine);
            attachTrafficEngine(engine);
            setRuntimeEngine(engine);
            
            // Use shared sound service from menu (preserves mute state)
            const menuSound = getMenuSound();
            if (menuSound) {
                engine.setSoundService(menuSound);
            }
            
            // Initialize modules with engine reference (removes global reach-through)
            initInteractionsModule(engine);
            initHudController(engine);
            initGameOverController(engine);
            initInputController(engine);
            initSandboxControls(engine); // Initialize sandbox controls (shows panel only in sandbox mode)
            initRenderManagers(engine);
            initToolSync(engine);
            initLevelConditions(engine);
            initCampaignControls(engine);
            initCampaignHubControls(engine);
            initScenariosController(engine);
            initToolbarController(engine);
            
            // Link the internet mesh to engine's internetNode after both exist
            linkInternetMesh(engine.getSimulation()?.internetNode);
            
            engine.setRunning(true);
            const disposeSpanningTree = initSpanningTreeManager(engine);
            const input = createInputController({ container });
            const loop = createLoop({
                engine,
                render: renderScene,
                afterFrame: (stepResult) => handleFrameSideEffects(engine, stepResult, controller, normalizedConfig)
            });

            loop.start();

            this.current = { engine, loop, input, modeConfig: normalizedConfig, controller, disposeSpanningTree };
            controller?.init?.({ engine, modeConfig: normalizedConfig, runtime: this });
            return this.current;
        },
        stop() {
            if (!this.current) return;
            const { loop, input, controller, engine, modeConfig, disposeSpanningTree } = this.current;
            loop.stop();
            disposeSpanningTree?.();
            controller?.teardown?.({ engine, modeConfig, runtime: this });
            teardownGameOverController();
            input.detach();
            disposeToolSync();
            disposeRenderManagers();
            disposeScene();
            clearRuntimeEngine();
            setRuntimeHandle(null);
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
    initMainMenuButtons();
    initWarningsPill();
    initTutorialController();
    initTimeControls();
    // Bind scenario menu buttons early (engine injected when mode starts)
    initScenariosController();
    // Bind static campaign hub buttons early (engine injected when mode starts)
    initCampaignHubControls();
    const runtime = createRuntime();

    // Initialize mode manager with runtime reference
    initModeManager(runtime);
    setRuntimeHandle(runtime);

    function popStartSandbox() {
        switchToMode(GAME_MODES.SANDBOX, {
            internetPosition: DEFAULT_INTERNET_POSITION
        });
    }

    function popStartCampaignLevel(levelId) {
        switchToMode(GAME_MODES.CAMPAIGN, { levelId });
    }

    return runtime;
}
