const TIME_BUTTON_IDS = {
    0: 'btn-pause',
    1: 'btn-play',
    3: 'btn-fast'
};

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
}
