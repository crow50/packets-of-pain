import { initGame, gameFrame } from "./gameCore.js";

initGame();

function loop(timestamp) {
    gameFrame(timestamp);
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
