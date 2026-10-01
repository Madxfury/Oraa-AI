import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Run the actual helpers without a browser or a new test framework dependency.
const source = await readFile(new URL('../src/generation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { readPrediction, withDeadline, pollGeneration, requestJson, errorMessage, spaceDistance } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const imageResult = { image_base64: 'data:image/png;base64,aGVsbG8=', prompt: 'view', metadata: {} };

test('camera distances match the upstream close, medium, and wide prompts', () => {
    assert.equal(spaceDistance(0.6), 0.6);
    assert.equal(spaceDistance(1.0), 1.0);
    assert.equal(spaceDistance(1.4), 1.8);
});

test('terminal data and status resolve without waiting for a broken iterator to close', async () => {
    async function* stalledIterator() {
        yield { type: 'data', data: [{ url: 'https://example.test/output.png' }, 42, 'view'] };
        yield { type: 'status', stage: 'complete', success: true };
        await new Promise(() => {});
    }
    const result = await withDeadline(readPrediction(stalledIterator()), 100);
    assert.equal(result[1], 42);
});

test('complete status before data is handled', async () => {
    async function* events() {
        yield { type: 'status', stage: 'complete', success: true };
        yield { type: 'data', data: ['image', 12] };
    }
    assert.deepEqual(await readPrediction(events()), ['image', 12]);
});

test('Gradio error objects become readable errors immediately', async () => {
    async function* events() {
        yield { type: 'status', stage: 'error', message: 'ZeroGPU quota exceeded' };
        await new Promise(() => {});
    }
    await assert.rejects(withDeadline(readPrediction(events()), 100), /quota exceeded/);
    assert.equal(errorMessage({ message: 'quota exceeded' }), 'quota exceeded');
});

test('queue position is displayed from upstream events', async () => {
    const progress = [];
    async function* events() {
        yield { type: 'status', stage: 'pending', position: 2, eta: 15 };
        yield { type: 'status', stage: 'generating' };
        yield { type: 'data', data: ['image'] };
        yield { type: 'status', stage: 'complete' };
    }
    await readPrediction(events(), value => progress.push(value));
    assert.equal(progress[0].message, 'Waiting for GPU — queue position 3.');
    assert.equal(progress[1].stage, 'generating');
});

test('stalled prediction has a hard deadline', async () => {
    await assert.rejects(withDeadline(new Promise(() => {}), 10), /did not finish in time/);
});

test('aborting an in-flight or already-aborted request settles immediately', async () => {
    const controller = new AbortController();
    const pending = withDeadline(new Promise(() => {}), 5000, controller.signal);
    controller.abort(new Error('cancelled'));
    await assert.rejects(pending, /cancelled/);
    await assert.rejects(withDeadline(new Promise(() => {}), 5000, controller.signal), /cancelled/);
});

test('polling returns complete image and rejects terminal errors', async () => {
    const signal = new AbortController().signal;
    assert.equal(await pollGeneration('http://test', { id: 'test', stage: 'complete', result: imageResult }, signal), imageResult);
    await assert.rejects(pollGeneration('http://test', { id: 'test', stage: 'error', message: 'GPU quota exceeded' }, signal), /quota/);
    await assert.rejects(pollGeneration('http://test', { id: 'test', stage: 'complete' }, signal), /without an image/);
});

test('cancellation stops the polling delay without another request', async () => {
    const controller = new AbortController();
    const pending = pollGeneration('http://test', { id: 'test', stage: 'queued' }, controller.signal);
    controller.abort(new Error('cancelled'));
    await assert.rejects(pending, /cancelled/);
});

test('HTTP failures surface the backend detail and polling uses fresh responses', async () => {
    const originalFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (_url, options) => {
        seen.push(options);
        return new Response(JSON.stringify({ detail: 'Invalid image' }), { status: 422 });
    };
    try {
        await assert.rejects(requestJson('http://test'), /Invalid image/);
        assert.equal(seen[0].cache, 'no-store');
        assert.ok(seen[0].signal instanceof AbortSignal);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

const apiSource = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
const helperUrl = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64');
const apiCompiled = ts.transpileModule(apiSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace("from './generation'", `from '${helperUrl}'`)
    .replace('import.meta.env.VITE_BACKEND_URL', "'http://test'");
const { generateImage } = await import('data:text/javascript;base64,' + Buffer.from(apiCompiled).toString('base64'));

async function withFakeFetch(implementation, run) {
    const original = globalThis.fetch;
    globalThis.fetch = implementation;
    try { await run(); } finally { globalThis.fetch = original; }
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

test('the editor API uses job polling and sends the requested camera settings', async () => {
    const calls = [];
    await withFakeFetch(async (url, options) => {
        calls.push([url, options]);
        if (url.endsWith('/health')) return jsonResponse({ generation_api: 'jobs-v1' });
        return jsonResponse({ id: 'job123', stage: 'complete', result: imageResult }, 202);
    }, async () => {
        const output = await generateImage(new File(['image'], 'input.png'), 45, 30, 1.4, 4, 1, 42, 'wide shot');
        assert.equal(output.image_base64, imageResult.image_base64);
        assert.equal(calls[1][0], 'http://test/generations');
        assert.equal(calls[1][1].body.get('guidance_scale'), '1');
        assert.equal(calls[1][1].body.get('distance'), '1.4');
        assert.equal(calls[1][1].body.get('output_size'), '512');
        assert.equal(calls.length, 2);
    });
});

test('an old backend prompts a restart instead of silently using the broken endpoint', async () => {
    await withFakeFetch(async () => jsonResponse({ status: 'ok' }), async () => {
        await assert.rejects(generateImage(new File(['image'], 'input.png'), 0, 0, 1, 4, 1, -1, ''), /Restart the Oraa AI backend/);
    });
});

test('Fast mode requests a smaller image without reducing the Lightning step count', async () => {
    let payload;
    await withFakeFetch(async (url, options) => {
        if (url.endsWith('/health')) return jsonResponse({ generation_api: 'jobs-v1' });
        payload = options.body;
        return jsonResponse({ id: 'fast-job', stage: 'complete', result: imageResult }, 202);
    }, async () => {
        await generateImage(new File(['image'], 'input.png'), 0, 0, 1, 4, 1, -1, '', undefined, { quality: 'fast' });
        assert.equal(payload.get('output_size'), '384');
        assert.equal(payload.get('steps'), '4');
    });
});

test('cancelling through the editor API sends DELETE to the backend job', async () => {
    const controller = new AbortController();
    const calls = [];
    await withFakeFetch(async (url, options) => {
        calls.push([url, options.method]);
        if (url.endsWith('/health')) return jsonResponse({ generation_api: 'jobs-v1' });
        if (options.method === 'DELETE') return jsonResponse({ id: 'job123', stage: 'cancelled' });
        return jsonResponse({ id: 'job123', stage: 'queued', message: 'Waiting for GPU' }, 202);
    }, async () => {
        await assert.rejects(generateImage(new File(['image'], 'input.png'), 0, 0, 1, 4, 1, -1, '', undefined,
            { signal: controller.signal, onProgress: progress => { if (progress.stage === 'queued') controller.abort(new Error('cancelled')); } }), /cancelled/);
        assert.ok(calls.some(([url, method]) => url.endsWith('/generations/job123') && method === 'DELETE'));
    });
});
