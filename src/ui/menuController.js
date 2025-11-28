/**
 * menuController.js - Hamburger menu dropdown controller
 * 
 * Centralizes game menu actions: Help, Sound toggle, Return to main menu
 */

let _isOpen = false;

/**
 * Initialize the hamburger menu dropdown
 * Call this after DOM is ready
 */
export function initHudMenu() {
    const btn = document.getElementById('hud-menu-button');
    const dropdown = document.getElementById('hud-menu-dropdown');
    const helpBtn = document.getElementById('hud-menu-help');
    const soundBtn = document.getElementById('hud-menu-sound');
    const soundStatus = document.getElementById('hud-menu-sound-status');
    const soundIcon = document.getElementById('hud-menu-sound-icon');
    const mainBtn = document.getElementById('hud-menu-main');

    if (!btn || !dropdown) return;

    function setOpen(open) {
        _isOpen = open;
        dropdown.classList.toggle('hidden', !open);
        // Sync sound status when opening menu
        if (open) updateSoundStatus();
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

    // Initial sound status sync
    updateSoundStatus();

    function updateSoundStatus() {
        const engine = window.__POP_RUNTIME__?.current?.engine;
        const sound = engine?.getUIState()?.sound || window.__menuSound;
        const muted = sound?.muted ?? true; // Default to muted (matches SoundService default)
        if (soundStatus) soundStatus.textContent = muted ? 'Off' : 'On';
        if (soundIcon) soundIcon.textContent = muted ? '🔇' : '🔊';
    }
}

/**
 * Check if hamburger menu is currently open
 */
export function isMenuOpen() {
    return _isOpen;
}
