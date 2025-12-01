import { openScenariosBrowser } from "./scenariosController.js";

/**
 * menuController.js - Hamburger menu dropdown controller
 * 
 * Centralizes game menu actions: Help, Sound toggle, Panel toggle, Return to main menu
 */

let _isOpen = false;
let _scorePanelHidden = false;
let _previousTimeScale = null;

/**
 * Initialize the hamburger menu dropdown
 * Call this after DOM is ready
 */
export function initHudMenu() {
    const btn = document.getElementById('hud-menu-button');
    const dropdown = document.getElementById('hud-menu-dropdown');
    const hudRoot = document.getElementById('hud-root');
    const helpBtn = document.getElementById('hud-menu-help');
    const soundBtn = document.getElementById('hud-menu-sound');
    const soundStatus = document.getElementById('hud-menu-sound-status');
    const soundIcon = document.getElementById('hud-menu-sound-icon');
    const panelsBtn = document.getElementById('hud-menu-panels');
    const panelsStatus = document.getElementById('hud-menu-panels-status');
    const panelsIcon = document.getElementById('hud-menu-panels-icon');
    const scenariosBtn = document.getElementById('hud-menu-scenarios');
    const mainBtn = document.getElementById('hud-menu-main');

    if (!btn || !dropdown) return;

    function getCurrentTimeScale() {
        return window.__POP_RUNTIME__?.current?.engine?.getUIState()?.timeScale ??
            window.__POP_RUNTIME__?.current?.state?.ui?.timeScale ??
            window.__POP_RUNTIME__?.ui?.timeScale ??
            0;
    }

    function setOpen(open) {
        _isOpen = open;
        dropdown.classList.toggle('hidden', !open);
        hudRoot?.classList.toggle('menu-open', open);

        if (open) {
            updateSoundStatus();
            updatePanelsStatus();

            const currentScale = getCurrentTimeScale();
            _previousTimeScale = currentScale;
            if (currentScale !== 0) {
                window.setTimeScale?.(0);
            }
        } else if (_previousTimeScale !== null) {
            if (_previousTimeScale !== 0) {
                window.setTimeScale?.(_previousTimeScale);
            }
            _previousTimeScale = null;
        }
    }

    // Toggle on button click
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(!_isOpen);
    });

    // Close on outside click
    document.addEventListener('click', () => {
        if (_isOpen) setOpen(false);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _isOpen) {
            setOpen(false);
        }
    });

    // Help button - reuse existing showFAQ
    helpBtn?.addEventListener('click', () => {
        setOpen(false);
        if (typeof window.showFAQ === 'function') {
            window.showFAQ();
        }
    });

    // Sound toggle - reuse existing toggleMute
    soundBtn?.addEventListener('click', () => {
        if (typeof window.toggleMute === 'function') {
            window.toggleMute();
        }
        updateSoundStatus();
    });

    // Panels toggle - show/hide score detail panel
    panelsBtn?.addEventListener('click', () => {
        toggleScorePanel();
        updatePanelsStatus();
    });

    scenariosBtn?.addEventListener('click', () => {
        setOpen(false);
        openScenariosBrowser('hud');
    });

    // Return to main menu
    mainBtn?.addEventListener('click', () => {
        setOpen(false);
        if (typeof window.returnToMainMenu === 'function') {
            window.returnToMainMenu();
        } else if (typeof window.showView === 'function') {
            window.__POP_RUNTIME__?.stop?.();
            window.showView('main-menu');
        }
    });

    // Initial status sync
    updateSoundStatus();
    updatePanelsStatus();

    function updateSoundStatus() {
        const engine = window.__POP_RUNTIME__?.current?.engine;
        const sound = engine?.getUIState()?.sound || window.__menuSound;
        const muted = sound?.muted ?? true; // Default to muted (matches SoundService default)
        if (soundStatus) soundStatus.textContent = muted ? 'Off' : 'On';
        if (soundIcon) soundIcon.textContent = muted ? '🔇' : '🔊';
    }

    function updatePanelsStatus() {
        if (panelsStatus) panelsStatus.textContent = _scorePanelHidden ? 'Off' : 'On';
        if (panelsIcon) panelsIcon.textContent = _scorePanelHidden ? '📊' : '📈';
    }
}

/**
 * Toggle visibility of the score details panel
 */
function toggleScorePanel() {
    _scorePanelHidden = !_scorePanelHidden;
    const panel = document.getElementById('details-panel');
    if (panel) {
        panel.classList.toggle('hidden', _scorePanelHidden);
    }
}

/**
 * Check if hamburger menu is currently open
 */
export function isMenuOpen() {
    return _isOpen;
}

/**
 * Check if score panel is hidden
 */
export function isScorePanelHidden() {
    return _scorePanelHidden;
}

export function initMainMenuButtons() {
    const campaignBtn = document.getElementById('main-menu-campaign');
    const sandboxBtn = document.getElementById('main-menu-sandbox');

    campaignBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        window.POP?.startCampaign?.();
    });
    sandboxBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        window.POP?.startSandbox?.();
    });

    const faqOpenBtn = document.getElementById('main-menu-show-faq');
    faqOpenBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        window.showFAQ?.('menu');
    });
    const faqCloseButtons = document.querySelectorAll('[data-faq-close]');
    faqCloseButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            window.closeFAQ?.();
        });
    });
}
