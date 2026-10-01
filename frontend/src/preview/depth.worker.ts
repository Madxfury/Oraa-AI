import { env, pipeline, RawImage } from '@huggingface/transformers';

env.allowLocalModels = false;
// One WASM thread works on static hosts without cross-origin isolation headers.
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.proxy = false;
const model = 'onnx-community/depth-anything-v2-small';
let estimator: Awaited<ReturnType<typeof createEstimator>> | undefined;
let cached: { id: number; depth: Float32Array } | undefined;
function createEstimator() {
    return pipeline('depth-estimation', model, {
        device: 'wasm', dtype: 'q8',
        progress_callback: (event) => {
            if (event.status === 'progress') {
                self.postMessage({ type: 'progress', message: `Downloading depth model: ${Math.round(event.progress)}%` });
            } else if (event.status === 'initiate') {
                self.postMessage({ type: 'progress', message: 'Loading the free depth model (cached after first use)…' });
            }
        },
    });
}
self.onmessage = async (event: MessageEvent<{ id: number; width: number; height: number; data: Uint8ClampedArray }>) => {
    const { id, width, height, data } = event.data;
    try {
        if (cached?.id === id) {
            self.postMessage({ type: 'depth', depth: cached.depth });
            return;
        }
        estimator ??= await createEstimator();
        self.postMessage({ type: 'progress', message: 'Estimating depth on your device…' });
        const result = await estimator(new RawImage(data, width, height, 4));
        const image = (Array.isArray(result) ? result[0] : result).depth;
        const resized = await image.resize(width, height);
        const depth = Float32Array.from({ length: width * height }, (_, i) => resized.data[i * resized.channels] / 255);
        cached = { id, depth };
        self.postMessage({ type: 'depth', depth });
    } catch {
        // The UI can still render an explicitly labelled flat perspective preview.
        self.postMessage({ type: 'unavailable' });
    }
};
