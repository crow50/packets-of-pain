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
    const panel = document.getElementById('topology-warnings-panel');
    const list = document.getElementById('topology-warnings-list');
    if (!panel || !list) return;
    
    const warnings = sim?.topologyWarnings?.warnings || [];
    
    if (warnings.length === 0) {
        panel.classList.add('hidden');
        return;
    }
    
    panel.classList.remove('hidden');
    list.innerHTML = warnings.map(w => `<li class="flex items-start gap-1"><span class="text-red-500">•</span>${w}</li>`).join('');
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

export function showGameOverModal(copy) {
    const modal = document.getElementById("modal");
    if (!modal) return;

    const titleEl = document.getElementById("modal-title");
    const descEl = document.getElementById("modal-desc");

    if (titleEl && copy?.title) {
        titleEl.innerText = copy.title;
    }
    if (descEl && copy?.message) {
        descEl.innerText = copy.message;
    }

    modal.classList.remove("hidden");
}
