import { GENERATION_SIZES, errorMessage, pollGeneration, readPrediction, requestJson, spaceDistance, withDeadline } from './generation';
import type { GenerateResponse, GenerationJob, GenerationProgress, GenerationQuality } from './generation';
export type { GenerateResponse, GenerationProgress, GenerationQuality } from './generation';

const SPACES = [
    'multimodalart/qwen-image-multiple-angles-3d-camera',
    'Woffee/qwen-image-multiple-angles-3d-camera',
];
const SPACE_TIMEOUT_MS = 80000;
const GENERATION_TIMEOUT_MS = 200000;

interface GenerationOptions {
    quality?: GenerationQuality;
    signal?: AbortSignal;
    onProgress?: (progress: GenerationProgress) => void;
}

async function prepareImage(file: File, signal: AbortSignal, outputSize: number) {
    if (file.size > 20 * 1024 * 1024) throw new Error('Please upload an image smaller than 20 MB.');
    const bitmap = await withDeadline(createImageBitmap(file, { imageOrientation: 'from-image' }), 10000, signal);
    try {
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not prepare the image.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await withDeadline(new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the image.')), 'image/jpeg', 0.85);
        }), 10000, signal);
        const outputScale = outputSize / Math.max(canvas.width, canvas.height);
        return { file: new File([blob], 'input.jpg', { type: 'image/jpeg' }),
            width: Math.max(256, Math.round(canvas.width * outputScale / 16) * 16),
            height: Math.max(256, Math.round(canvas.height * outputScale / 16) * 16) };
    } finally {
        bitmap.close();
    }
}

async function generateDirect(
    file: File, yaw: number, pitch: number, distance: number, steps: number,
    guidanceScale: number, seed: number, prompt: string, hfToken: string | undefined,
    signal: AbortSignal, outputSize: number, onProgress?: (progress: GenerationProgress) => void,
): Promise<GenerateResponse> {
    const started = performance.now();
    const { Client, handle_file } = await import('@gradio/client');
    const prepared = await prepareImage(file, signal, outputSize);
    const errors: string[] = [];
    const actualSeed = seed === -1 ? crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647 : seed;
    for (const [index, space] of SPACES.entries()) {
        signal.throwIfAborted();
        let client: Awaited<ReturnType<typeof Client.connect>> | undefined;
        let submission: ReturnType<Awaited<ReturnType<typeof Client.connect>>['submit']> | undefined;
        const deadline = performance.now() + SPACE_TIMEOUT_MS;
        onProgress?.({ stage: index === 0 ? 'connecting' : 'fallback',
            message: index === 0 ? 'Connecting to image generation…' : 'Trying the backup GPU service…' });
        try {
            // Close a connection that resolves after its deadline as well.
            let abandoned = false;
            try {
                const connecting = Client.connect(space, {
                    events: ['data', 'status'],
                    ...(hfToken?.trim() ? { token: hfToken.trim() as `hf_${string}` } : {}),
                }).then(value => { if (abandoned) value.close(); return value; });
                client = await withDeadline(connecting, Math.min(15000, deadline - performance.now()), signal);
            } finally {
                abandoned = true;
            }
            submission = client.submit('/infer_camera_edit', {
                image: handle_file(prepared.file), azimuth: yaw % 360, elevation: pitch,
                distance: spaceDistance(distance), seed: actualSeed, randomize_seed: false,
                guidance_scale: guidanceScale, num_inference_steps: steps,
                height: prepared.height, width: prepared.width,
            });
            const output = await withDeadline(readPrediction(submission, onProgress), Math.max(1, deadline - performance.now()), signal);
            const image = output[0];
            const url = typeof image === 'string' ? image :
                image && typeof image === 'object' && 'url' in image && typeof image.url === 'string' ? image.url : null;
            if (!url) throw new Error('The GPU service returned no image.');
            // Validate the download before declaring success and use a stable data URL.
            const response = await withDeadline(fetch(url, { signal }), 15000, signal);
            if (!response.ok) throw new Error('The generated image could not be downloaded.');
            const blob = await withDeadline(response.blob(), 15000, signal);
            if (!blob.size || !blob.type.startsWith('image/')) throw new Error('The GPU service returned an invalid image.');
            const imageUrl = await withDeadline(new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('Could not read the generated image.'));
                reader.readAsDataURL(blob);
            }), 10000, signal);
            return { image_base64: imageUrl, prompt: typeof output[2] === 'string' ? output[2] : prompt,
                metadata: { steps, guidance_scale: guidanceScale, seed: typeof output[1] === 'number' ? output[1] : actualSeed,
                    inference_time: (performance.now() - started) / 1000, engine: `huggingface/${space}`,
                    resolution: `${prepared.width}x${prepared.height}` } };
        } catch (error) {
            if (signal.aborted) throw signal.reason;
            errors.push(errorMessage(error));
        } finally {
            // Cancellation is best effort; do not block fallback on a failed network.
            if (submission) void submission.cancel().catch(() => undefined);
            client?.close();
        }
    }
    const messages = errors.join(' ').toLowerCase();
    if (/quota|exceeded|zerogpu|gpu task aborted/.test(messages)) {
        throw new Error('Hugging Face GPU quota is exhausted or the GPU is busy. Try again later, or use your personal Hugging Face token.');
    }
    if (/401|403|unauthorized|invalid token/.test(messages)) throw new Error('Hugging Face rejected the token. Check its permissions or remove it.');
    throw new Error(`Image generation failed: ${errors.at(-1) ?? 'GPU services are unavailable.'}`);
}

export const generateImage = async (
    file: File, yaw: number, pitch: number, distance: number, steps: number,
    guidance_scale: number, seed: number, prompt: string, hfToken?: string,
    options: GenerationOptions = {},
): Promise<GenerateResponse> => {
    const outputSize = GENERATION_SIZES[options.quality ?? 'balanced'];
    const backendUrl = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const timeout = setTimeout(() => controller.abort(new Error('Generation exceeded its time limit. Please try again later.')), GENERATION_TIMEOUT_MS);
    let jobId: string | undefined;
    let finished = false;
    try {
        options.onProgress?.({ stage: 'connecting', message: 'Starting image generation…' });
        let health: { generation_api?: string } | undefined;
        try {
            const check = new AbortController();
            const cancelCheck = () => check.abort(controller.signal.reason);
            controller.signal.addEventListener('abort', cancelCheck, { once: true });
            if (controller.signal.aborted) cancelCheck();
            const timer = setTimeout(() => check.abort(), 3000);
            try { health = await requestJson(`${backendUrl}/health`, {}, check.signal); }
            finally { clearTimeout(timer); controller.signal.removeEventListener('abort', cancelCheck); }
        } catch {
            controller.signal.throwIfAborted();
        }
        if (health) {
            if (health.generation_api !== 'jobs-v1') throw new Error('Restart the Oraa AI backend to load the image generation fix.');
            const form = new FormData();
            form.append('file', file);
            form.append('output_size', String(outputSize));
            for (const [key, value] of Object.entries({ yaw, pitch, distance, steps, guidance_scale, seed, prompt })) form.append(key, String(value));
            if (hfToken?.trim()) form.append('hf_token', hfToken.trim());
            const job = await requestJson<GenerationJob>(`${backendUrl}/generations`, { method: 'POST', body: form }, controller.signal);
            jobId = job.id;
            const result = await pollGeneration(backendUrl, job, controller.signal, options.onProgress);
            finished = true;
            return result;
        }
        const result = await generateDirect(file, yaw, pitch, distance, steps, guidance_scale, seed, prompt,
            hfToken, controller.signal, outputSize, options.onProgress);
        finished = true;
        return result;
    } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw new Error(errorMessage(error));
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
        if (jobId && !finished) {
            void requestJson(`${backendUrl}/generations/${jobId}`, { method: 'DELETE', keepalive: true }).catch(() => undefined);
        }
    }
};
