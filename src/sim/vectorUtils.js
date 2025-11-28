export function copyPosition(target, source) {
    if (!target || !source) return;
    target.x = source.x;
    target.y = source.y;
    target.z = source.z;
}

export function toPosition(source) {
    if (!source) return { x: 0, y: 0, z: 0 };
    const { x = 0, y = 0, z = 0 } = source;
    return { x, y, z };
}

export function toPlainPosition(source) {
    return toPosition(source);
}

export function distance(a, b) {
    if (!a || !b) return Infinity;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function lerpPosition(target, from, to, t) {
    if (!target || !from || !to) return;
    target.x = from.x + (to.x - from.x) * t;
    target.y = from.y + (to.y - from.y) * t;
    target.z = from.z + (to.z - from.z) * t;
}
