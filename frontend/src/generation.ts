import type { Client } from '@gradio/client';
type GradioEvent = ReturnType<Client['submit']> extends AsyncIterable<infer Event> ? Event : never;

export interface GenerateResponse {
    image_base64: string;
    prompt: string;
    metadata: {
        steps: number;
        guidance_scale: number;
        seed: number;
        inference_time: number;
        engine?: string;
        resolution?: string;
        cached?: boolean;
    };
}

export interface GenerationProgress {
    stage: string;
    message: string;
    queue_position?: number | null;
    eta?: number | null;
}

export interface GenerationJob extends GenerationProgress {
    id: string;
    result?: GenerateResponse;
    error_code?: number;
}

export function spaceDistance(distance: number): number {
    const snapped = [0.6, 1.0, 1.4].reduce((previous, value) =>
        Math.abs(value - distance) < Math.abs(previous - distance) ? value : previous);
    return snapped === 1.4 ? 1.8 : snapped;
}

export function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
        return typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
    }
    return String(error);
}

export function withDeadline<T>(operation: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
        };
        const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Cancelled', 'AbortError')); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('The GPU service did not finish in time.')); }, timeoutMs);
        signal?.addEventListener('abort', abort, { once: true });
        operation.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
        if (signal?.aborted) abort();
    });
}

export async function requestJson<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(new Error('The server did not respond in time.')), 15000);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(errorMessage(data.detail ?? `Server error: ${response.status}`));
        return data as T;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

export async function pollGeneration(
    backendUrl: string, initialJob: GenerationJob, signal: AbortSignal,
    onProgress?: (progress: GenerationProgress) => void,
): Promise<GenerateResponse> {
    let job = initialJob;
    while (true) {
        signal.throwIfAborted();
        onProgress?.(job);
        if (job.stage === 'complete') {
            if (!job.result?.image_base64) throw new Error('The server finished without an image.');
            return job.result;
        }
        if (job.stage === 'error' || job.stage === 'cancelled') throw new Error(job.message);
        // Abortable delay avoids an extra poll after the user presses Cancel.
        await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(signal.reason); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
        });
        job = await requestJson<GenerationJob>(`${backendUrl}/generations/${job.id}`, {}, signal);
    }
}

export async function readPrediction(
    submission: AsyncIterable<GradioEvent>,
    onProgress?: (progress: GenerationProgress) => void,
): Promise<unknown[]> {
    let output: unknown[] | undefined;
    let complete = false;
    for await (const event of submission) {
        if (event.type === 'data') output = event.data as unknown[];
        if (event.type === 'status') {
            if (event.stage === 'error' || event.success === false) throw new Error(errorMessage(event.message ?? 'The GPU service failed.'));
            if (event.stage === 'complete') complete = true;
            if (event.stage === 'pending') {
                onProgress?.({ stage: 'queued', queue_position: event.position, eta: event.eta,
                    message: event.position != null ? `Waiting for GPU — queue position ${event.position + 1}.` : 'Waiting for an available GPU…' });
            }
            if (event.stage === 'generating' || event.stage === 'streaming') {
                onProgress?.({ stage: 'generating', message: 'Generating your camera view…' });
            }
        }
        // Resolve on the terminal events even if a client iterator fails to close.
        if (output && complete) return output;
    }
    if (output) return output;
    throw new Error('The GPU service finished without an image.');
}
