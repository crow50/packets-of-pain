import { hideGameOverModal, showGameOverModal } from "./hudController.js";

let _engine = null;
let _unsubscribe = null;

function handleGameOver(payload = {}) {
    const failure = payload.failure;
    if (!failure) return;
    const title = failure.title || "SYSTEM FAILURE";
    const message = failure.message || failure.description || "The network has collapsed.";
    showGameOverModal({ title, message }, failure.actions);
}

export function init(engine) {
    if (!engine) return;
    _engine = engine;
    _unsubscribe?.();
    _unsubscribe = _engine.on("pop-mode:gameOver", handleGameOver);
    hideGameOverModal();
}

export function teardown() {
    _unsubscribe?.();
    _unsubscribe = null;
    _engine = null;
}
