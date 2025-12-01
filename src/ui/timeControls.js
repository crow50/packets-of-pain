const TIME_BUTTON_IDS = {
    0: 'btn-pause',
    1: 'btn-play',
    3: 'btn-fast'
};
const RESTART_BUTTON_ID = 'btn-restart';

function clearTimeButtonStates() {
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('active', 'pulse-green');
    });
}

function highlightButton(scale) {
    clearTimeButtonStates();
    const targetId = TIME_BUTTON_IDS[scale];
    const targetButton = targetId ? document.getElementById(targetId) : null;
    if (!targetButton) return;
    targetButton.classList.add('active');
    if (scale === 0) {
        targetButton.classList.add('pulse-green');
    }
}

export function initTimeControls() {
    window.addEventListener('pop-timeScaleChanged', (event) => {
        if (event?.detail?.scale === undefined) return;
        highlightButton(event.detail.scale);
    });

    const initialScale = window.__POP_RUNTIME__?.current?.engine?.getUIState()?.timeScale ?? 1;
    highlightButton(initialScale);

    Object.entries(TIME_BUTTON_IDS).forEach(([scaleKey, buttonId]) => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.addEventListener('click', () => {
            const scale = Number(scaleKey);
            if (Number.isFinite(scale)) {
                window.setTimeScale?.(scale);
            }
        });
    });

    const restartButton = document.getElementById(RESTART_BUTTON_ID);
    restartButton?.addEventListener('click', () => {
        window.restartGame?.();
    });
}
