// Depth-image reprojection uses visible pixels only; uncovered regions stay transparent.
export const PREVIEW_LIMITS = { yaw: 15, pitch: 10, minDistance: 0.85, maxDistance: 1.15 };
export interface PreviewCamera { yaw: number; pitch: number; distance: number }
export interface PreviewPixels { width: number; height: number; data: Uint8ClampedArray }
export function clampCamera(camera: PreviewCamera): PreviewCamera {
    const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
    return {
        yaw: Math.max(-15, Math.min(15, finite(camera.yaw, 0))),
        pitch: Math.max(-10, Math.min(10, finite(camera.pitch, 0))),
        distance: Math.max(0.85, Math.min(1.15, finite(camera.distance, 1))),
    };
}
export function reproject(source: PreviewPixels, depth: Float32Array | null, camera: PreviewCamera): PreviewPixels {
    const { width, height, data } = source;
    if (data.length !== width * height * 4 || (depth && depth.length !== width * height)) {
        throw new Error('The image and depth dimensions do not match.');
    }
    const { yaw, pitch, distance } = clampCamera(camera);
    if (yaw === 0 && pitch === 0 && distance === 1) return { width, height, data: data.slice() };
    const output = new Uint8ClampedArray(data.length);
    const zBuffer = new Float32Array(width * height).fill(Infinity);
    const ry = yaw * Math.PI / 180, rx = pitch * Math.PI / 180;
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    const f = Math.max(width, height) * 0.9, centerX = (width - 1) / 2, centerY = (height - 1) / 2;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (!data[i * 4 + 3]) continue;
            const z = 2.5 - (depth ? depth[i] : 0.5) * 0.6;
            const px = (x - centerX) * z / f, py = (y - centerY) * z / f;
            const rotatedX = cy * px - sy * (z - 2.2);
            const rotatedZ = sy * px + cy * (z - 2.2);
            const rotatedY = cx * py + sx * rotatedZ;
            const viewZ = -sx * py + cx * rotatedZ + 2.2 * distance;
            if (viewZ <= 0) continue;
            const ox = Math.round(rotatedX * f / viewZ + centerX);
            const oy = Math.round(rotatedY * f / viewZ + centerY);
            // A small pixel footprint closes sampling gaps without inventing hidden surfaces.
            for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
                const tx = ox + dx, ty = oy + dy;
                if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
                const target = ty * width + tx;
                if (viewZ >= zBuffer[target]) continue;
                zBuffer[target] = viewZ;
                output.set(data.subarray(i * 4, i * 4 + 4), target * 4);
            }
        }
    }
    return { width, height, data: output };
}
