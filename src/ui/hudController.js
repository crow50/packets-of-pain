import { getTopologyGuidance } from "../modes/modeState.js";

// Module-level engine reference, set via init()
let _engine = null;

// Track if HUD is hidden by user (H key)
let _hudHidden = false;

function setTextContent(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function updateScoreboard(sim) {
    if (!sim) return;
    const score = sim.score || {};
    setTextContent('total-score-display', score.total ?? 0);
    setTextContent('score-web', score.web ?? 0);
    setTextContent('score-api', score.api ?? 0);
    setTextContent('score-fraud', score.fraudBlocked ?? 0);
}

function updateReputationBar(sim) {
    const bar = document.getElementById('rep-bar');
    if (!bar) return;
    const reputation = typeof sim?.reputation === 'number' ? sim.reputation : 100;
    const clamped = Math.max(0, Math.min(100, reputation));
    bar.style.width = `${clamped}%`;
    bar.classList.toggle('bg-red-500', clamped <= 30);
    bar.classList.toggle('bg-yellow-500', clamped > 30 && clamped <= 70);
    bar.classList.toggle('bg-green-500', clamped > 70);
}

/**
 * Initialize HUD controller with engine reference
 * @param {object} engine - The game engine instance
 */
export function init(engine) {
    _engine = engine;
    _hudHidden = false;
}

/**
 * Set HUD visibility state (called by input controller on H key)
 */
export function setHudHidden(hidden) {
    _hudHidden = hidden;
}

/**
 * Get current HUD visibility state
 */
export function isHudHidden() {
    return _hudHidden;
}

export function updateSimulationHud(state) {
    if (!state) return;

    // Handle both nested { simulation, ui } and flat state
    const sim = state.simulation || state;

    const rpsDisplay = document.getElementById("rps-display");
    if (rpsDisplay && typeof sim.currentRPS === "number") {
        rpsDisplay.innerText = `${sim.currentRPS.toFixed(1)} req/s`;
    }

    const moneyDisplay = document.getElementById("money-display");
    if (moneyDisplay && typeof sim.money === "number") {
        moneyDisplay.innerText = `$${sim.money.toFixed(2)}`;
    }

    updateScoreboard(sim);
    updateReputationBar(sim);

    const upkeepDisplay = document.getElementById("upkeep-display");
    if (upkeepDisplay && Array.isArray(sim.services)) {
        const upkeepPerSecond = sim.services.reduce((sum, service) => {
            const upkeepPerMinute = service?.config?.upkeep ?? 0;
            return sum + upkeepPerMinute / 60;
        }, 0);
        upkeepDisplay.innerText = `-$${upkeepPerSecond.toFixed(2)}/s`;
    }
    
    // Update topology warnings
    updateTopologyWarnings(sim);
    
    // Update bottleneck display
    updateBottleneckDisplay();
}

/**
 * Update the topology warnings panel based on sim.topologyWarnings
 */
function updateTopologyWarnings(sim) {
    const pill = document.getElementById('warnings-pill');
    const pillLabel = pill?.querySelector('span');
    const section = document.getElementById('topology-warnings-section');
    const list = document.getElementById('topology-warnings-list');
    if (!pill || !section || !list) return;

    const resetSection = () => {
        pill.classList.add('hidden');
        section.classList.add('hidden');
        section.dataset.expanded = 'false';
        list.innerHTML = '';
    };

    if (_hudHidden) {
        resetSection();
        return;
    }

    const customGuidance = getTopologyGuidance();
    const simWarnings = Array.isArray(sim?.topologyWarnings?.warnings) ? sim.topologyWarnings.warnings : [];
    const usingGuidance = simWarnings.length === 0 && customGuidance.length > 0;
    const warnings = simWarnings.length > 0 ? simWarnings : customGuidance;
    if (warnings.length === 0) {
        resetSection();
        return;
    }

    pill.classList.remove('hidden');
    if (pillLabel) {
        if (usingGuidance) {
            const label = warnings.length === 1 ? 'Guide' : 'Guides';
            pillLabel.textContent = `ℹ ${warnings.length} ${label}`;
        } else {
            const label = warnings.length === 1 ? 'Issue' : 'Issues';
            pillLabel.textContent = `⚠ ${warnings.length} ${label}`;
        }
    }

    const bulletClass = usingGuidance ? 'text-blue-400' : 'text-red-500';
    list.innerHTML = warnings.map(w => `<li class="flex items-start gap-1"><span class="${bulletClass}">•</span>${w}</li>`).join('');
    const expanded = section.dataset.expanded === 'true';
    section.classList.toggle('hidden', !expanded);
}

/**
 * Update the bottleneck/hottest node display
 */
function updateBottleneckDisplay() {
    const container = document.getElementById('bottleneck-display');
    const nameEl = document.getElementById('bottleneck-name');
    const barEl = document.getElementById('bottleneck-bar');
    if (!container || !nameEl || !barEl) return;
    
    const mostLoaded = window.Routing?.getMostLoadedService?.();
    
    if (!mostLoaded || mostLoaded.utilization < 0.1) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    const utilPct = Math.round(mostLoaded.utilization * 100);
    nameEl.innerText = `${mostLoaded.displayName} (${utilPct}%)`;
    barEl.style.width = `${utilPct}%`;
    
    // Color based on utilization
    if (utilPct > 80) {
        barEl.classList.remove('bg-orange-500', 'bg-yellow-500');
        barEl.classList.add('bg-red-500');
    } else if (utilPct > 50) {
        barEl.classList.remove('bg-red-500', 'bg-yellow-500');
        barEl.classList.add('bg-orange-500');
    } else {
        barEl.classList.remove('bg-red-500', 'bg-orange-500');
        barEl.classList.add('bg-yellow-500');
    }
}

export function showGameOverModal(copy, actions) {
    const modal = document.getElementById("modal");
    if (!modal) return;

    const titleEl = document.getElementById("modal-title");
    const descEl = document.getElementById("modal-desc");
    const actionsEl = document.getElementById('modal-actions');

    if (titleEl && copy?.title) {
        titleEl.innerText = copy.title;
    }
    if (descEl && copy?.message) {
        descEl.innerText = copy.message;
    }

    if (actionsEl) {
        actionsEl.innerHTML = '';
        const defaultActions = [{
            label: 'Try Again',
            onClick: () => window.restartGame?.()
        }];
        const buttonDefs = Array.isArray(actions) && actions.length ? actions : defaultActions;
        buttonDefs.forEach(action => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform transition hover:scale-105 font-mono uppercase text-sm';
            btn.innerText = action.label || 'Action';
            if (typeof action.onClick === 'function') {
                btn.addEventListener('click', action.onClick);
            }
            actionsEl.appendChild(btn);
        });
    }

    modal.classList.remove("hidden");
}

export function hideGameOverModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    const actionsEl = document.getElementById('modal-actions');
    if (actionsEl) {
        actionsEl.innerHTML = '';
    }
}
