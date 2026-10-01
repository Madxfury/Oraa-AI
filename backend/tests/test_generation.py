import asyncio
import base64
import io
import threading
import time
import unittest
from concurrent.futures import CancelledError as FutureCancelledError
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import httpx
from fastapi import HTTPException
from PIL import Image
import main
import fal_provider


def image_bytes(width=640, height=320):
    buffer = io.BytesIO()
    Image.new('RGB', (width, height), 'teal').save(buffer, format='PNG')
    return buffer.getvalue()


def result(seed=42):
    return {'image_base64': 'data:image/png;base64,' + base64.b64encode(image_bytes()).decode(),
            'seed': seed, 'prompt': '<sks> front-left quarter view eye-level shot medium shot'}


class GenerationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.environment = patch.dict(main.os.environ, {'IMAGE_PROVIDER': 'huggingface'})
        self.environment.start()
        main._cache.clear()
        main._jobs.clear()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='http://test')

    async def asyncTearDown(self):
        self.environment.stop()
        tasks = list(main._tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        main._tasks.clear()
        main._jobs.clear()
        main._cache.clear()
        await self.client.aclose()

    async def generate(self, seed=42, steps=4, guidance=1):
        return await main._generate(image_bytes(), 45, 0, 1, steps, guidance, seed, '', None, lambda _: None)

    async def test_timeout_uses_backup_once_and_returns_valid_image(self):
        provider = AsyncMock(side_effect=[TimeoutError('queue stalled'), result()])
        with patch.object(main, 'call_hf_space', provider), patch.object(main, 'HF_SPACES', ['primary', 'backup']):
            output = await self.generate()
        self.assertEqual(provider.await_count, 2)
        self.assertEqual(output['metadata']['engine'], 'huggingface/backup')
        self.assertEqual(output['metadata']['resolution'], '512x256')
        self.assertEqual(output['metadata']['steps'], 4)
        self.assertEqual(output['metadata']['guidance_scale'], 1)
        decoded = base64.b64decode(output['image_base64'].split(',', 1)[1])
        with Image.open(io.BytesIO(decoded)) as image:
            image.verify()

    async def test_random_seed_changes_and_fixed_seed_reuses_cache(self):
        async def provider(_image, parameters, *_args):
            return result(parameters['seed'])
        mock = AsyncMock(side_effect=provider)
        with patch.object(main, 'call_hf_space', mock):
            first = await self.generate()
            cached = await self.generate()
            changed_steps = await self.generate(steps=8)
            changed_seed = await self.generate(seed=43)
            with patch.object(main.secrets, 'randbelow', side_effect=[100, 101]):
                random_one = await self.generate(seed=-1)
                random_two = await self.generate(seed=-1)
        self.assertFalse(first['metadata']['cached'])
        self.assertTrue(cached['metadata']['cached'])
        self.assertFalse(changed_steps['metadata']['cached'])
        self.assertEqual(changed_seed['metadata']['seed'], 43)
        self.assertNotEqual(random_one['metadata']['seed'], random_two['metadata']['seed'])
        self.assertEqual(mock.await_count, 5)

    async def test_jobs_return_immediately_and_poll_to_completion(self):
        started = asyncio.Event()
        finish = asyncio.Event()
        async def provider(*_args):
            started.set()
            await finish.wait()
            return result()
        with patch.object(main, 'call_hf_space', AsyncMock(side_effect=provider)):
            response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')}, data={'seed': '42'})
            self.assertEqual(response.status_code, 202)
            job_id = response.json()['id']
            await started.wait()
            queued = await self.client.get('/generations/' + job_id)
            self.assertNotEqual(queued.json()['stage'], 'complete')
            finish.set()
            await main._tasks[job_id]
            complete = await self.client.get('/generations/' + job_id)
        self.assertEqual(complete.json()['stage'], 'complete')
        self.assertTrue(complete.json()['result']['image_base64'].startswith('data:image/'))
        self.assertNotIn('updated', complete.json())

    async def test_cancellation_reaches_the_active_provider(self):
        started = asyncio.Event()
        cancelled = asyncio.Event()
        async def provider(*_args):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()
        with patch.object(main, 'call_hf_space', AsyncMock(side_effect=provider)):
            response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')})
            job_id = response.json()['id']
            await started.wait()
            response = await self.client.delete('/generations/' + job_id)
            await asyncio.wait_for(cancelled.wait(), 1)
        self.assertEqual(response.json()['stage'], 'cancelled')
        self.assertEqual(main._jobs[job_id]['stage'], 'cancelled')

    async def test_quota_failure_is_terminal_and_actionable(self):
        with patch.object(main, 'call_hf_space', AsyncMock(side_effect=RuntimeError('ZeroGPU quota exceeded'))):
            response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')})
            job_id = response.json()['id']
            await main._tasks[job_id]
        job = (await self.client.get('/generations/' + job_id)).json()
        self.assertEqual(job['stage'], 'error')
        self.assertEqual(job['error_code'], 429)
        self.assertIn('quota', job['message'])

    async def test_invalid_image_rejected_before_provider_call(self):
        provider = AsyncMock()
        with patch.object(main, 'call_hf_space', provider):
            response = await self.client.post('/generations', files={'file': ('bad.png', b'not an image', 'image/png')})
        self.assertEqual(response.status_code, 422)
        provider.assert_not_called()

    async def test_angle_validation_and_expired_jobs(self):
        response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')}, data={'pitch': '90'})
        self.assertEqual(response.status_code, 422)
        self.assertEqual((await self.client.get('/generations/missing')).status_code, 404)
        main._jobs['old'] = {'id': 'old', 'stage': 'complete', 'updated': time.monotonic() - main.JOB_TTL_S - 1}
        self.assertEqual((await self.client.get('/generations/old')).status_code, 404)

    async def test_global_deadline_cancels_a_stalled_job(self):
        with patch.object(main, 'GENERATION_TIMEOUT_S', 0.02):
            async def stalled(**_):
                await asyncio.sleep(100)
            with patch.object(main, '_generate', stalled):
                response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')})
                job_id = response.json()['id']
                await main._tasks[job_id]
        self.assertEqual(main._jobs[job_id]['stage'], 'error')
        self.assertEqual(main._jobs[job_id]['error_code'], 504)

    async def test_four_job_limit_prevents_unbounded_executor_queue(self):
        async def stalled(**_):
            await asyncio.Event().wait()
        with patch.object(main, '_generate', stalled):
            for _ in range(main.MAX_ACTIVE_JOBS):
                response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')})
                self.assertEqual(response.status_code, 202)
            response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')})
        self.assertEqual(response.status_code, 429)

    async def test_legacy_generate_remains_compatible(self):
        with patch.object(main, 'call_hf_space', AsyncMock(return_value=result())):
            response = await self.client.post('/generate', files={'file': ('input.png', image_bytes(), 'image/png')}, data={'seed': '42'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['metadata']['steps'], 4)

    async def test_wide_camera_distance_maps_to_the_space_wide_shot(self):
        provider = AsyncMock(return_value=result())
        with patch.object(main, 'call_hf_space', provider):
            await main._generate(image_bytes(), 45, 0, 1.4, 4, 1, 42, '', None, lambda _: None)
        self.assertEqual(provider.call_args.args[1]['distance'], 1.8)

    async def test_fast_preview_reduces_gpu_dimensions_and_has_a_separate_cache_entry(self):
        provider = AsyncMock(return_value=result())
        raw = image_bytes(640, 640)
        with patch.object(main, 'call_hf_space', provider):
            fast = await main._generate(raw, 45, 0, 1, 4, 1, 42, '', None, lambda _: None, output_size=384)
            balanced = await main._generate(raw, 45, 0, 1, 4, 1, 42, '', None, lambda _: None, output_size=512)
        self.assertEqual(provider.await_count, 2)
        self.assertEqual(fast['metadata']['resolution'], '384x384')
        self.assertEqual(balanced['metadata']['resolution'], '512x512')
        self.assertEqual(provider.await_args_list[0].args[1]['num_inference_steps'], 4)
        self.assertEqual(provider.await_args_list[0].args[1]['width'], 384)

    async def test_job_and_legacy_endpoints_accept_valid_preview_sizes(self):
        provider = AsyncMock(return_value=result())
        with patch.object(main, 'call_hf_space', provider):
            response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(640, 640), 'image/png')}, data={'output_size': '384', 'seed': '42'})
            self.assertEqual(response.status_code, 202)
            job_id = response.json()['id']
            await main._tasks[job_id]
            self.assertEqual(main._jobs[job_id]['result']['metadata']['resolution'], '384x384')
            response = await self.client.post('/generate', files={'file': ('input.png', image_bytes(640, 640), 'image/png')}, data={'output_size': '384', 'seed': '42'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['metadata']['resolution'], '384x384')
        for size in ['128', '385', '2048']:
            response = await self.client.post('/generations', files={'file': ('input.png', image_bytes(), 'image/png')}, data={'output_size': size})
            self.assertEqual(response.status_code, 422)

    async def test_paid_provider_requires_explicit_selection(self):
        paid = AsyncMock(return_value=result())
        with patch.dict(main.os.environ, {'FAL_KEY': 'test-only-key'}), patch.object(main, 'call_fal', paid), patch.object(main, 'call_hf_space', AsyncMock(return_value=result())):
            await self.generate()
        paid.assert_not_called()
        with patch.dict(main.os.environ, {'IMAGE_PROVIDER': 'fal'}), patch.object(main, 'call_fal', paid):
            output = await self.generate()
        paid.assert_awaited_once()
        self.assertEqual(output['metadata']['steps'], 28)
        self.assertEqual(output['metadata']['guidance_scale'], 4.5)
        self.assertTrue(output['metadata']['engine'].startswith('fal/'))

    async def test_fal_missing_key_reports_configuration_error_without_network_calls(self):
        with patch.dict(main.os.environ, {'FAL_KEY': '', 'IMAGE_PROVIDER': 'fal'}):
            with self.assertRaises(HTTPException) as raised:
                await self.generate()
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn('FAL_KEY', raised.exception.detail)

    async def test_fal_downloads_validates_and_maps_zoom(self):
        from fal_client import Queued, Completed
        handle = SimpleNamespace(status=AsyncMock(side_effect=[Queued(2), Completed(None, {})]),
                                 get=AsyncMock(return_value={'images': [{'url': 'https://test/image.png'}], 'seed': 42, 'prompt': 'wide'}),
                                 cancel=AsyncMock())
        transport = httpx.MockTransport(lambda request: httpx.Response(200, content=image_bytes(), headers={'content-type': 'image/png'}))
        downloader = httpx.AsyncClient(transport=transport)
        progress = []
        parameters = {'distance': 1.8, 'azimuth': 45, 'elevation': 0, 'width': 512,
                      'height': 256, 'seed': 42, 'num_inference_steps': 28, 'guidance_scale': 4.5}
        with patch.dict(main.os.environ, {'FAL_KEY': 'test-only-key'}), patch.object(fal_provider.fal_client, 'submit_async', AsyncMock(return_value=handle)) as submit, patch.object(fal_provider.httpx, 'AsyncClient', return_value=downloader), patch.object(fal_provider.asyncio, 'sleep', AsyncMock()):
            output = await fal_provider.call_fal(image_bytes(), parameters, progress.append)
        self.assertEqual(submit.call_args.kwargs['arguments']['zoom'], 0)
        self.assertTrue(output['image_base64'].startswith('data:image/png;base64,'))
        self.assertEqual(progress[0]['queue_position'], 2)
        handle.cancel.assert_not_called()

    async def test_fal_cancels_a_failed_request(self):
        handle = SimpleNamespace(status=AsyncMock(side_effect=RuntimeError('GPU failed')), cancel=AsyncMock())
        parameters = {'distance': 1, 'azimuth': 0, 'elevation': 0, 'width': 512,
                      'height': 512, 'seed': 42, 'num_inference_steps': 28, 'guidance_scale': 4.5}
        with patch.dict(main.os.environ, {'FAL_KEY': 'test-only-key'}), patch.object(fal_provider.fal_client, 'submit_async', AsyncMock(return_value=handle)):
            with self.assertRaises(RuntimeError):
                await fal_provider.call_fal(image_bytes(), parameters, lambda _: None)
        handle.cancel.assert_awaited_once()


class WorkerTests(unittest.TestCase):
    def test_upstream_cancellation_is_a_provider_failure_and_stream_read_timeout_is_long_enough(self):
        job = Mock()
        job.done.return_value = True
        job.result.side_effect = FutureCancelledError()
        client = Mock()
        client.submit.return_value = job
        with patch.object(main, 'Client', return_value=client) as factory, patch.object(main, 'handle_file', side_effect=lambda value: value):
            with self.assertRaisesRegex(RuntimeError, 'interrupted'):
                main._call_hf_space_sync(image_bytes(), {}, 'test-space', None, time.monotonic() + 1, threading.Event(), lambda _: None)
        timeout = factory.call_args.kwargs['httpx_kwargs']['timeout']
        self.assertGreater(timeout.read, main.SPACE_TIMEOUT_S)
        self.assertEqual(timeout.connect, main.HTTP_TIMEOUT_S)

    def test_stopped_worker_cancels_upstream_job_and_releases_files(self):
        job = Mock()
        job.done.return_value = False
        job.status.return_value = SimpleNamespace(code=SimpleNamespace(name='IN_QUEUE'), rank=2, eta=30)
        client = Mock()
        client.submit.return_value = job
        stopped = threading.Event()
        progress = []
        def on_progress(update):
            progress.append(update)
            stopped.set()
        with patch.object(main, 'Client', return_value=client), patch.object(main, 'handle_file', side_effect=lambda value: value):
            with self.assertRaises(TimeoutError):
                main._call_hf_space_sync(image_bytes(), {}, 'test-space', None, time.monotonic() + 1, stopped, on_progress)
        job.cancel.assert_called_once()
        client.close.assert_called_once()
        client.executor.shutdown.assert_called_once_with(wait=False, cancel_futures=True)
        self.assertFalse(Path(client.submit.call_args.kwargs['image']).exists())
        self.assertEqual(progress[0]['queue_position'], 2)

    def test_png_output_uses_the_correct_mime_type(self):
        job = Mock()
        job.done.return_value = True
        client = Mock()
        client.submit.return_value = job
        def connect(*_args, **kwargs):
            path = Path(kwargs['download_files']) / 'result.png'
            path.write_bytes(image_bytes())
            job.result.return_value = (str(path), 42, '<sks> view')
            return client
        with patch.object(main, 'Client', side_effect=connect), patch.object(main, 'handle_file', side_effect=lambda value: value):
            output = main._call_hf_space_sync(image_bytes(), {'seed': 42}, 'test-space', None, time.monotonic() + 1, threading.Event(), lambda _: None)
        self.assertTrue(output['image_base64'].startswith('data:image/png;base64,'))
        job.cancel.assert_not_called()


if __name__ == '__main__':
    unittest.main()
