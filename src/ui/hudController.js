export function updateSimulationHud(state) {
    if (!state) return;

    const rpsDisplay = document.getElementById("rps-display");
    if (rpsDisplay && typeof state.currentRPS === "number") {
        rpsDisplay.innerText = `${state.currentRPS.toFixed(1)} req/s`;
    }

    const moneyDisplay = document.getElementById("money-display");
    if (moneyDisplay && typeof state.money === "number") {
        moneyDisplay.innerText = `$${state.money.toFixed(2)}`;
    }

    const upkeepDisplay = document.getElementById("upkeep-display");
    if (upkeepDisplay && Array.isArray(state.services)) {
        const upkeepPerSecond = state.services.reduce((sum, service) => {
            const upkeepPerMinute = service?.config?.upkeep ?? 0;
            return sum + upkeepPerMinute / 60;
        }, 0);
        upkeepDisplay.innerText = `-$${upkeepPerSecond.toFixed(2)}/s`;
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
