import { spawnBurstOfType } from '../sim/traffic.js';

let _engine = null;

export function initSandboxControls(engine) {
    _engine = engine;
    
        const panel = document.getElementById('sandbox-panel');
    if (!panel) return;
    
    const state = engine.getState();
    const isSandbox = state.ui.gameMode === 'sandbox';
    
    // Show/hide panel based on mode
    panel.classList.toggle('hidden', !isSandbox);
    if (!isSandbox) return;
    
    // Initialize UI from CONFIG.sandbox defaults
    const sandboxConfig = CONFIG.sandbox;
    const sim = state.simulation;
    
    // Budget control - use CONFIG default
    const budgetInput = document.getElementById('sandbox-budget-input');
    const budgetSetBtn = document.getElementById('sandbox-budget-set');
    if (budgetInput) budgetInput.value = sandboxConfig.defaultBudget;
    budgetSetBtn?.addEventListener('click', () => {
        const value = parseFloat(budgetInput.value) || 0;
        engine.setSandboxBudget(value);
    });
    
    // RPS slider - use CONFIG default
    const rpsSlider = document.getElementById('sandbox-rps-slider');
    const rpsValue = document.getElementById('sandbox-rps-value');
    if (rpsSlider) rpsSlider.value = sandboxConfig.defaultRPS;
    if (rpsValue) rpsValue.textContent = sandboxConfig.defaultRPS.toFixed(1);
    rpsSlider?.addEventListener('input', () => {
        const value = parseFloat(rpsSlider.value);
        engine.setRPS(value);
        if (rpsValue) rpsValue.textContent = value.toFixed(1);
    });
    
    // Traffic mix sliders - use CONFIG defaults
    setupTrafficMixSliders(engine, sandboxConfig.trafficDistribution);
    
    // Upkeep toggle - default off in sandbox
    const upkeepToggle = document.getElementById('sandbox-upkeep-toggle');
    updateUpkeepButton(false);
    upkeepToggle?.addEventListener('click', () => {
        const newState = sim.upkeepEnabled === false;
        engine.toggleUpkeep(newState);
        updateUpkeepButton(newState);
    });
    
    // Burst buttons - use CONFIG burstCount
    const burstCount = sandboxConfig.burstCount;
    document.getElementById('sandbox-burst-web')?.addEventListener('click', () => {
        spawnBurstOfType(state, TRAFFIC_TYPES.WEB, burstCount);
    });
    document.getElementById('sandbox-burst-api')?.addEventListener('click', () => {
        spawnBurstOfType(state, TRAFFIC_TYPES.API, burstCount);
    });
    document.getElementById('sandbox-burst-fraud')?.addEventListener('click', () => {
        spawnBurstOfType(state, TRAFFIC_TYPES.FRAUD, burstCount);
    });
    
    // Preset buttons
    document.querySelectorAll('.sandbox-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetKey = btn.dataset.preset;
            applyPreset(engine, presetKey);
        });
    });
    
    // Clear all button
    document.getElementById('sandbox-clear-all')?.addEventListener('click', () => {
        if (confirm('Clear all services and reset metrics?')) {
            engine.clearAllServices();
        }
    });
}

function setupTrafficMixSliders(engine, defaultDistribution) {
    const webSlider = document.getElementById('sandbox-mix-web');
    const apiSlider = document.getElementById('sandbox-mix-api');
    const fraudSlider = document.getElementById('sandbox-mix-fraud');
    const webValue = document.getElementById('sandbox-mix-web-value');
    const apiValue = document.getElementById('sandbox-mix-api-value');
    const fraudValue = document.getElementById('sandbox-mix-fraud-value');
    
    // Initialize from CONFIG defaults (already normalized 0-1, convert to 0-100)
    const dist = defaultDistribution;
    if (webSlider) webSlider.value = dist[TRAFFIC_TYPES.WEB] * 100;
    if (apiSlider) apiSlider.value = dist[TRAFFIC_TYPES.API] * 100;
    if (fraudSlider) fraudSlider.value = dist[TRAFFIC_TYPES.FRAUD] * 100;
    
    // Update display values
    function updateDisplay() {
        const web = parseFloat(webSlider?.value || 0);
        const api = parseFloat(apiSlider?.value || 0);
        const fraud = parseFloat(fraudSlider?.value || 0);
        
        if (webValue) webValue.textContent = Math.round(web) + '%';
        if (apiValue) apiValue.textContent = Math.round(api) + '%';
        if (fraudValue) fraudValue.textContent = Math.round(fraud) + '%';
        
        // Update engine with normalized values
        const total = web + api + fraud;
        if (total > 0) {
            engine.setTrafficDistribution({
                [TRAFFIC_TYPES.WEB]: web / total,
                [TRAFFIC_TYPES.API]: api / total,
                [TRAFFIC_TYPES.FRAUD]: fraud / total
            });
        }
    }
    
    // Dynamic adjustment: when one slider moves, others adjust proportionally to maintain 100%
    function adjustOthers(changedSlider, otherSliders) {
        const newValue = parseFloat(changedSlider.value);
        const remaining = 100 - newValue;
        
        // Get current values of other sliders
        const otherValues = otherSliders.map(s => parseFloat(s.value));
        const otherTotal = otherValues.reduce((a, b) => a + b, 0);
        
        if (otherTotal === 0) {
            // Distribute remaining equally if others are zero
            const each = remaining / otherSliders.length;
            otherSliders.forEach(s => s.value = each);
        } else {
            // Scale others proportionally
            otherSliders.forEach((s, i) => {
                s.value = (otherValues[i] / otherTotal) * remaining;
            });
        }
        
        updateDisplay();
    }
    
    webSlider?.addEventListener('input', () => adjustOthers(webSlider, [apiSlider, fraudSlider].filter(Boolean)));
    apiSlider?.addEventListener('input', () => adjustOthers(apiSlider, [webSlider, fraudSlider].filter(Boolean)));
    fraudSlider?.addEventListener('input', () => adjustOthers(fraudSlider, [webSlider, apiSlider].filter(Boolean)));
    
    // Initial display update
    updateDisplay();
}

function updateUpkeepButton(enabled) {
    const btn = document.getElementById('sandbox-upkeep-toggle');
    if (!btn) return;
    
    if (enabled) {
        btn.textContent = 'On';
        btn.classList.remove('text-gray-400', 'border-gray-600');
        btn.classList.add('text-green-400', 'border-green-600', 'bg-green-900/30');
    } else {
        btn.textContent = 'Off';
        btn.classList.remove('text-green-400', 'border-green-600', 'bg-green-900/30');
        btn.classList.add('text-gray-400', 'border-gray-600');
    }
}

function applyPreset(engine, presetKey) {
    const preset = CONFIG.sandbox.presets[presetKey];
    if (!preset) return;
    
    // Apply RPS
    engine.setRPS(preset.rps);
    const rpsSlider = document.getElementById('sandbox-rps-slider');
    const rpsValue = document.getElementById('sandbox-rps-value');
    if (rpsSlider) rpsSlider.value = preset.rps;
    if (rpsValue) rpsValue.textContent = preset.rps.toFixed(1);
    
    // Apply distribution
    engine.setTrafficDistribution(preset.distribution);
    
    // Update sliders to reflect preset (denormalized to raw values)
    const webSlider = document.getElementById('sandbox-mix-web');
    const apiSlider = document.getElementById('sandbox-mix-api');
    const fraudSlider = document.getElementById('sandbox-mix-fraud');
    
    if (webSlider) webSlider.value = preset.distribution[TRAFFIC_TYPES.WEB] * 100;
    if (apiSlider) apiSlider.value = preset.distribution[TRAFFIC_TYPES.API] * 100;
    if (fraudSlider) fraudSlider.value = preset.distribution[TRAFFIC_TYPES.FRAUD] * 100;
    
    // Update display values
    const webValue = document.getElementById('sandbox-mix-web-value');
    const apiValue = document.getElementById('sandbox-mix-api-value');
    const fraudValue = document.getElementById('sandbox-mix-fraud-value');
    
    if (webValue) webValue.textContent = Math.round(preset.distribution[TRAFFIC_TYPES.WEB] * 100) + '%';
    if (apiValue) apiValue.textContent = Math.round(preset.distribution[TRAFFIC_TYPES.API] * 100) + '%';
    if (fraudValue) fraudValue.textContent = Math.round(preset.distribution[TRAFFIC_TYPES.FRAUD] * 100) + '%';
    
    // Flash the preset button
    const btn = document.querySelector(`[data-preset="${presetKey}"]`);
    if (btn) {
        btn.classList.add('bg-cyan-600');
        setTimeout(() => btn.classList.remove('bg-cyan-600'), 200);
    }
}

export function hideSandboxPanel() {
    const panel = document.getElementById('sandbox-panel');
    panel?.classList.add('hidden');
}

export function showSandboxPanel() {
    if (!_engine) return;
    const state = _engine.getState();
    if (state.ui.gameMode !== 'sandbox') return;

    const panel = document.getElementById('sandbox-panel');
    panel?.classList.remove('hidden');
}
