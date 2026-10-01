import { clampCamera, reproject } from './render';
import type { PreviewCamera, PreviewPixels } from './render';
import type { GenerationProgress, GenerationQuality } from '../generation';

let worker: Worker | undefined;
let lastFile: File | undefined;
let lastSize = 0;
let cachedSource: PreviewPixels | undefined;
let cachedDepth: Float32Array | null | undefined;
let imageId = 0;
let busy = false;
const stopWorker = () => { worker?.terminate(); worker = undefined; };

async function prepare(file: File, size: number, signal: AbortSignal): Promise<PreviewPixels> {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Please choose an image smaller than 20 MB.');
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
        signal.throwIfAborted();
        const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Your browser could not open the image.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    } finally { bitmap.close(); }
}

function estimate(source: PreviewPixels, signal: AbortSignal, onProgress?: (progress: GenerationProgress) => void): Promise<Float32Array | null> {
    return new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
        const unavailable = () => { cleanup(); stopWorker(); resolve(null); };
        const abort = () => { cleanup(); stopWorker(); reject(signal.reason); };
        const timer = setTimeout(unavailable, 90000);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { abort(); return; }
        try {
            worker ??= new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module' });
            worker.onerror = unavailable;
            worker.onmessage = ({ data }) => {
                if (data.type === 'progress') onProgress?.({ stage: 'depth', message: data.message });
                if (data.type === 'depth') { cleanup(); resolve(data.depth); }
                if (data.type === 'unavailable') unavailable();
            };
            worker.postMessage({ ...source, id: imageId });
        } catch { unavailable(); }
    });
}

export async function generatePreview(file: File, camera: PreviewCamera, options: {
    quality: GenerationQuality; signal: AbortSignal; onProgress?: (progress: GenerationProgress) => void;
}): Promise<{ imageUrl: string; notice: string; engine: 'depth' | 'basic' }> {
    if (busy) throw new Error('A preview is already running.');
    busy = true;
    const { signal, onProgress } = options;
    const size = options.quality === 'fast' ? 384 : 512;
    try {
        signal.throwIfAborted();
        onProgress?.({ stage: 'preparing', message: 'Preparing your image locally…' });
        if (file !== lastFile || size !== lastSize || !cachedSource) {
            cachedSource = await prepare(file, size, signal);
            lastFile = file; lastSize = size; cachedDepth = undefined; imageId++;
        }
        if (cachedDepth === undefined) {
            onProgress?.({ stage: 'loading', message: 'Loading the depth model. First use needs a download…' });
            cachedDepth = await estimate(cachedSource, signal, onProgress);
        }
        signal.throwIfAborted();
        onProgress?.({ stage: 'rendering', message: 'Rendering your perspective preview…' });
        // Yield so status and Cancel remain responsive before the short reprojection pass.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        signal.throwIfAborted();
        const result = reproject(cachedSource, cachedDepth, clampCamera(camera));
        const canvas = document.createElement('canvas');
        canvas.width = result.width; canvas.height = result.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not render the preview.');
        context.putImageData(new ImageData(new Uint8ClampedArray(result.data), result.width, result.height), 0, 0);
        return {
            imageUrl: canvas.toDataURL('image/png'),
            engine: cachedDepth ? 'depth' : 'basic',
            notice: cachedDepth
                ? 'Depth preview of visible pixels only. Transparent areas have no source data; unseen sides are not generated.'
                : 'Basic perspective preview: the depth model could not load. Your image stays local; unseen sides are not generated.',
        };
    } finally { busy = false; }
}

export function resetPreview() {
    stopWorker(); lastFile = undefined; cachedSource = undefined; cachedDepth = undefined;
}
