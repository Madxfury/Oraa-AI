import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64');
const renderSource = await readFile(new URL('../src/preview/render.ts', import.meta.url), 'utf8');
const { clampCamera, reproject } = await import(moduleUrl(renderSource));
const source = { width: 32, height: 24, data: Uint8ClampedArray.from({ length: 32 * 24 * 4 }, (_, i) => i % 4 === 3 ? 255 : i % 251) };
const depth = Float32Array.from({ length: 32 * 24 }, (_, i) => (i % 32) / 31);

test('camera limits reject unsupported back and side views and handle invalid numbers', () => {
    assert.deepEqual(clampCamera({ yaw: 180, pitch: -60, distance: 0.6 }), { yaw: 15, pitch: -10, distance: 0.85 });
    assert.deepEqual(clampCamera({ yaw: NaN, pitch: Infinity, distance: NaN }), { yaw: 0, pitch: 0, distance: 1 });
});
test('neutral perspective preserves visible source pixels exactly', () => {
    const output = reproject(source, depth, { yaw: 0, pitch: 0, distance: 1 });
    assert.deepEqual(output.data, source.data);
    assert.notEqual(output.data, source.data);
});
test('depth reprojection changes the image and preserves transparent unknown regions', () => {
    const output = reproject(source, depth, { yaw: 15, pitch: 10, distance: 1.15 });
    assert.notDeepEqual(output.data, source.data);
    assert.equal(output.data.length, source.data.length);
    assert.ok(output.data.some((value, i) => i % 4 === 3 && value === 0));
    assert.ok(output.data.some((value, i) => i % 4 === 3 && value === 255));
});
test('basic perspective works without a model and bad depth dimensions are rejected', () => {
    assert.equal(reproject(source, null, { yaw: -12, pitch: -8, distance: 1 }).data.length, source.data.length);
    assert.throws(() => reproject(source, new Float32Array(3), { yaw: 0, pitch: 0, distance: 1 }), /dimensions/);
});

// Exercise the actual browser client with worker and canvas stand-ins, without cloud requests.
const clientSource = await readFile(new URL('../src/preview/client.ts', import.meta.url), 'utf8');
const client = await import(moduleUrl(clientSource.replace("new URL('./depth.worker.ts', import.meta.url)", "new URL('file:///depth.worker.ts')").replace("'./render'", JSON.stringify(moduleUrl(renderSource)))));
let workerCount = 0, terminated = 0, depthRequests = 0, mode = 'success';
globalThis.fetch = () => { throw new Error('Local preview must not call an inference API'); };
globalThis.Worker = class {
    constructor() { workerCount++; }
    postMessage() {
        depthRequests++;
        if (mode === 'stall') return;
        if (mode === 'fault') { queueMicrotask(() => this.onerror({})); return; }
        queueMicrotask(() => this.onmessage({ data: mode === 'fail' ? { type: 'unavailable' } : { type: 'depth', depth: new Float32Array(16).fill(0.5) } }));
    }
    terminate() { terminated++; }
};
globalThis.createImageBitmap = async () => ({ width: 4, height: 4, close() {} });
globalThis.ImageData = class { constructor(data) { this.data = data; } };
globalThis.document = { createElement() { return {
    getContext() { return { drawImage() {}, getImageData() { return { data: new Uint8ClampedArray(64).fill(255) }; }, putImageData() {} }; },
    toDataURL() { return 'data:image/png;base64,preview'; },
}; } };
const file = { type: 'image/png', size: 100 };
const camera = { yaw: 10, pitch: 0, distance: 1 };
const options = () => ({ quality: 'fast', signal: new AbortController().signal });
test('local preview reuses depth across angles and never sends an inference request', async () => {
    client.resetPreview(); mode = 'success';
    const before = depthRequests;
    const first = await client.generatePreview(file, camera, options());
    const second = await client.generatePreview(file, { ...camera, yaw: -10 }, options());
    assert.equal(first.engine, 'depth'); assert.equal(second.engine, 'depth');
    assert.equal(depthRequests - before, 1);
    assert.ok(workerCount >= 1);
    assert.match(first.notice, /unseen sides/);
});
test('model failure returns an explicitly labelled basic preview', async () => {
    client.resetPreview(); mode = 'fail';
    const result = await client.generatePreview(file, camera, options());
    assert.equal(result.engine, 'basic'); assert.match(result.notice, /could not load/);
    assert.match(result.imageUrl, /^data:image\/png/);
});
test('cancel terminates inference and a subsequent preview can run', async () => {
    client.resetPreview(); mode = 'stall';
    const controller = new AbortController(), before = terminated;
    const pending = client.generatePreview(file, camera, { quality: 'fast', signal: controller.signal });
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort(new DOMException('Cancelled', 'AbortError'));
    await assert.rejects(pending, { name: 'AbortError' });
    assert.ok(terminated > before);
    mode = 'success';
    assert.equal((await client.generatePreview(file, camera, options())).engine, 'depth');
});
test('invalid uploads fail before loading a model', async () => {
    client.resetPreview();
    await assert.rejects(client.generatePreview({ type: 'text/plain', size: 4 }, camera, options()), /image file/);
    await assert.rejects(client.generatePreview({ type: 'image/png', size: 21 * 1024 * 1024 }, camera, options()), /20 MB/);
});
test('stalled model loading settles as a basic preview', async () => {
    client.resetPreview(); mode = 'stall';
    const realTimer = globalThis.setTimeout;
    let deadline;
    globalThis.setTimeout = (callback, delay, ...args) => {
        if (delay === 90000) { deadline = callback; return realTimer(() => {}, 90000); }
        return realTimer(callback, delay, ...args);
    };
    try {
        const pending = client.generatePreview(file, camera, options());
        await new Promise(resolve => realTimer(resolve, 0));
        assert.equal(typeof deadline, 'function');
        deadline();
        assert.equal((await pending).engine, 'basic');
    } finally { globalThis.setTimeout = realTimer; client.resetPreview(); }
});

test('worker crashes return a basic preview instead of a blank result', async () => {
    client.resetPreview(); mode = 'fault';
    const before = terminated;
    const result = await client.generatePreview(file, camera, options());
    assert.equal(result.engine, 'basic');
    assert.ok(terminated > before);
    client.resetPreview();
});
