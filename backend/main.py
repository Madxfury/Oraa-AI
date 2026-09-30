import asyncio
import base64
import hashlib
import io
import json
import logging
import os
import secrets
import tempfile
import threading
import time
from collections import OrderedDict
from concurrent.futures import CancelledError as FutureCancelledError, ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable, Optional

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from gradio_client import Client, handle_file
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel
from fal_provider import call_fal

load_dotenv(Path(__file__).with_name('.env'))
logger = logging.getLogger('oraa.generation')

# Match the Space's four-step Lightning adapter; reduce output GPU work as well as upload size.
NUM_STEPS = 4
GUIDANCE_SCALE = 1.0
MAX_SIDE = 512
OUTPUT_SIZE = max(256, min(1024, int(os.getenv('IMAGE_OUTPUT_SIZE', '512')))) // 16 * 16
GENERATION_TIMEOUT_S = 180
SPACE_TIMEOUT_S = 80
HTTP_TIMEOUT_S = 15
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_ACTIVE_JOBS = 4
CACHE_MAX_SIZE = 20
CACHE_TTL_S = 1800
JOB_TTL_S = 600
_executor = ThreadPoolExecutor(max_workers=MAX_ACTIVE_JOBS)
_cache: OrderedDict[str, tuple[float, dict]] = OrderedDict()
_jobs: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}
_token_index = 0


def _load_hf_spaces() -> list[str]:
    configured = os.getenv('HF_SPACES', '') or os.getenv('HF_SPACE', '')
    spaces = [space.strip() for space in configured.split(',') if space.strip()]
    return spaces or [
        'multimodalart/qwen-image-multiple-angles-3d-camera',
        'Woffee/qwen-image-multiple-angles-3d-camera',
    ]


HF_SPACES = _load_hf_spaces()


def _next_pool_token() -> Optional[str]:
    global _token_index
    configured = (os.getenv('HF_TOKENS', '') or os.getenv('HF_TOKEN', '')
                  or os.getenv('HUGGINGFACE_CO_TOKEN', ''))
    tokens = [token.strip() for token in configured.split(',')
              if token.strip().startswith('hf_')]
    if not tokens:
        return None
    token = tokens[_token_index % len(tokens)]
    _token_index += 1
    return token


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    tasks = list(_tasks.values())
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title='Oraa AI Backend', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=['*'], allow_credentials=False,
    allow_methods=['*'], allow_headers=['*'],
)


class GenerationResponse(BaseModel):
    image_base64: str
    prompt: str
    metadata: dict


def prepare_image_bytes(raw: bytes) -> bytes:
    with Image.open(io.BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=85, optimize=True)
        return output.getvalue()


def _output_dimensions(image_bytes: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(image_bytes)) as image:
        scale = OUTPUT_SIZE / max(image.size)
        return tuple(max(256, round(side * scale / 16) * 16) for side in image.size)


def _cache_key(image_bytes: bytes, **parameters) -> str:
    digest = hashlib.sha256(image_bytes)
    digest.update(json.dumps(parameters, sort_keys=True).encode())
    return digest.hexdigest()


def _cache_get(key: str) -> Optional[dict]:
    entry = _cache.get(key)
    if entry and time.monotonic() - entry[0] < CACHE_TTL_S:
        _cache.move_to_end(key)
        return {**entry[1], 'metadata': {**entry[1]['metadata'], 'cached': True}}
    _cache.pop(key, None)
    return None


def _cache_put(key: str, value: dict):
    _cache[key] = (time.monotonic(), value)
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX_SIZE:
        _cache.popitem(last=False)


def _status_message(status) -> dict:
    if status.code.name in {'IN_QUEUE', 'JOINING_QUEUE', 'STARTING'}:
        rank = status.rank
        message = f'Waiting for GPU — queue position {rank + 1}.' if rank is not None else 'Waiting for an available GPU…'
        return {'stage': 'queued', 'message': message, 'queue_position': rank,
                'eta': status.eta}
    return {'stage': 'generating', 'message': 'Generating your camera view…'}


def _call_hf_space_sync(
    image_bytes: bytes, parameters: dict, hf_space: str,
    hf_token: Optional[str], deadline: float, stopped: threading.Event,
    on_progress: Callable[[dict], None],
) -> dict:
    """Poll a cancellable job instead of leaving predict() blocked after a timeout."""
    client = None
    job = None
    try:
        with tempfile.TemporaryDirectory(prefix='oraa-') as directory:
            input_path = Path(directory) / 'input.jpg'
            input_path.write_bytes(image_bytes)
            client = Client(
                hf_space, token=hf_token, verbose=False, analytics_enabled=False,
                # The queue stream can be silent while the GPU works. A short read
                # timeout cancels otherwise healthy predictions; the job deadline
                # below handles stalled generation separately from connect timeouts.
                httpx_kwargs={'timeout': httpx.Timeout(HTTP_TIMEOUT_S, read=SPACE_TIMEOUT_S + 5)},
                download_files=directory,
            )
            if stopped.is_set() or time.monotonic() >= deadline:
                raise TimeoutError('Space connection timed out.')
            job = client.submit(image=handle_file(str(input_path)),
                                **parameters, api_name='/infer_camera_edit')
            previous = None
            while not job.done():
                if stopped.is_set() or time.monotonic() >= deadline:
                    raise TimeoutError('The GPU queue did not finish within the time limit.')
                progress = _status_message(job.status())
                if progress != previous:
                    on_progress(progress)
                    previous = progress
                stopped.wait(0.5)
            result = job.result(timeout=1)
            if not isinstance(result, (tuple, list)) or not result or not result[0]:
                raise RuntimeError('The Space returned no image.')
            output = result[0]
            path = output.get('path') if isinstance(output, dict) else output
            if not isinstance(path, str) or not Path(path).is_file():
                raise RuntimeError('The generated image could not be downloaded.')
            # Expiring remote URLs must not strand the output panel after generation.
            with Image.open(path) as image:
                image.load()
                mime = Image.MIME.get(image.format, 'image/png')
            encoded = base64.b64encode(Path(path).read_bytes()).decode()
            return {'image_base64': f'data:{mime};base64,{encoded}',
                    'seed': result[1] if len(result) > 1 else parameters['seed'],
                    'prompt': result[2] if len(result) > 2 else ''}
    except FutureCancelledError as error:
        # asyncio converts concurrent.futures.CancelledError to task cancellation.
        # An upstream disconnect must trigger fallback, not cancel the user's job.
        raise RuntimeError('The upstream GPU connection was interrupted.') from error
    finally:
        if job is not None and not job.done():
            try:
                job.cancel()
            except Exception:
                logger.warning('Could not cancel the upstream job for %s', hf_space)
        if client is not None:
            client.close()
            client.executor.shutdown(wait=False, cancel_futures=True)


async def call_hf_space(image_bytes: bytes, parameters: dict, hf_space: str,
                        hf_token: Optional[str], timeout: float,
                        on_progress: Callable[[dict], None]) -> dict:
    loop = asyncio.get_running_loop()
    stopped = threading.Event()
    deadline = time.monotonic() + timeout

    def notify(progress):
        # Discard late events from a cancelled provider before starting the fallback.
        def deliver():
            if not stopped.is_set():
                on_progress({**progress, 'space': hf_space})
        if not stopped.is_set():
            loop.call_soon_threadsafe(deliver)

    try:
        future = loop.run_in_executor(
            _executor, _call_hf_space_sync, image_bytes, parameters, hf_space,
            hf_token, deadline, stopped, notify,
        )
        return await asyncio.wait_for(future, timeout=timeout)
    finally:
        stopped.set()


async def _generate(raw: bytes, yaw: float, pitch: float, distance: float,
                    steps: int, guidance_scale: float, seed: int, prompt: str,
                    hf_token: Optional[str], on_progress: Callable[[dict], None]) -> dict:
    started = time.monotonic()
    image_bytes = prepare_image_bytes(raw)
    width, height = _output_dimensions(image_bytes)
    provider = os.getenv('IMAGE_PROVIDER', 'huggingface').strip().lower()
    if provider not in {'huggingface', 'fal'}:
        raise HTTPException(503, 'IMAGE_PROVIDER must be huggingface or fal in backend/.env.')
    # The public Space uses a different wide-shot distance than Oraa's sliders.
    snapped_distance = min((0.6, 1.0, 1.4), key=lambda value: abs(value - distance))
    remote_distance = {0.6: 0.6, 1.0: 1.0, 1.4: 1.8}[snapped_distance]
    if provider == 'fal':
        # fal hosts the regular model; use its documented settings, not Lightning's.
        steps, guidance_scale = 28, 4.5
    parameters = {
        'azimuth': yaw % 360, 'elevation': pitch, 'distance': remote_distance,
        'seed': seed if seed != -1 else secrets.randbelow(2147483647),
        'randomize_seed': False, 'guidance_scale': guidance_scale,
        'num_inference_steps': steps, 'width': width, 'height': height,
    }
    key = _cache_key(image_bytes, provider=provider, **parameters)
    cached = _cache_get(key)
    if cached:
        return cached
    token = (hf_token or '').strip() or _next_pool_token()
    errors = []
    spaces = ['fal-ai/qwen-image-edit-2511-multiple-angles'] if provider == 'fal' else HF_SPACES
    for index, space in enumerate(spaces):
        remaining = GENERATION_TIMEOUT_S - (time.monotonic() - started)
        if remaining <= 0:
            break
        on_progress({'stage': 'connecting' if index == 0 else 'fallback',
                     'message': 'Connecting to image generation…' if index == 0 else 'Trying the backup GPU service…',
                     'space': space})
        try:
            if provider == 'fal':
                result = await asyncio.wait_for(call_fal(image_bytes, parameters, on_progress), timeout=remaining)
            else:
                result = await call_hf_space(image_bytes, parameters, space, token,
                                             min(SPACE_TIMEOUT_S, remaining), on_progress)
            response = {
                'image_base64': result['image_base64'],
                'prompt': result['prompt'] or prompt,
                'metadata': {
                    'engine': f'{provider}/{space}', 'seed': int(result['seed']),
                    'steps': steps, 'guidance_scale': guidance_scale,
                    'resolution': f'{width}x{height}',
                    'inference_time': round(time.monotonic() - started, 2),
                    'cached': False,
                },
            }
            _cache_put(key, response)
            return response
        except asyncio.CancelledError:
            raise
        except HTTPException:
            raise
        except Exception as error:
            logger.warning('Generation failed on %s (%s)', space, type(error).__name__)
            errors.append(error)
    messages = ' '.join(str(error).lower() for error in errors)
    if provider == 'fal':
        if any(word in messages for word in ('unauthorized', 'invalid key', '401', '403')):
            raise HTTPException(401, 'fal rejected FAL_KEY. Check your backend API key and its permissions.')
        if any(word in messages for word in ('balance', 'credit', 'payment', '402')):
            raise HTTPException(402, 'The fal account needs API credits. Check your fal balance or switch IMAGE_PROVIDER to huggingface.')
        if errors and all(isinstance(error, (TimeoutError, asyncio.TimeoutError)) for error in errors):
            raise HTTPException(504, 'The fal GPU service did not finish in time. Please try again later.')
        raise HTTPException(503, 'The fal image generation service is unavailable. Please try again later.')
    if any(word in messages for word in ('quota', 'exceeded', 'zerogpu', 'gpu task aborted')):
        raise HTTPException(429, 'Hugging Face GPU quota is exhausted or the GPU is busy. Try again later, or use your personal Hugging Face token. Tokens from the same account share its quota.')
    if errors and all(isinstance(error, (TimeoutError, asyncio.TimeoutError)) for error in errors):
        raise HTTPException(504, 'The GPU services did not finish in time. The queued jobs were cancelled; please try again later.')
    if any(word in messages for word in ('unauthorized', 'invalid token', '401', '403')):
        raise HTTPException(401, 'Hugging Face rejected the token. Check its permissions or remove it to try public access.')
    raise HTTPException(503, 'Image generation is temporarily unavailable on the GPU services. Please try again later.')


async def _read_image(file: UploadFile) -> bytes:
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, 'Please upload an image smaller than 20 MB.')
    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, 'Please upload a valid JPG, PNG, or WebP image.')
    return raw


def _prune_jobs():
    for job_id, job in list(_jobs.items()):
        if job_id not in _tasks and time.monotonic() - job['updated'] > JOB_TTL_S:
            del _jobs[job_id]
    completed = [job_id for job_id in _jobs if job_id not in _tasks]
    for job_id in completed[:-20]:
        del _jobs[job_id]


def _job_response(job_id: str) -> dict:
    return {key: value for key, value in _jobs[job_id].items() if key != 'updated'}


async def _run_job(job_id: str, **parameters):
    def update(progress):
        if _jobs[job_id]['stage'] != 'cancelled':
            _jobs[job_id].update(progress, updated=time.monotonic())

    try:
        result = await asyncio.wait_for(
            _generate(**parameters, on_progress=update), timeout=GENERATION_TIMEOUT_S,
        )
        update({'stage': 'complete', 'message': 'Your image is ready.', 'result': result})
    except asyncio.CancelledError:
        _jobs[job_id].update(stage='cancelled', message='Generation cancelled.', updated=time.monotonic())
    except (HTTPException, TimeoutError, asyncio.TimeoutError) as error:
        message = error.detail if isinstance(error, HTTPException) else 'The generation time limit was reached. Please try again later.'
        update({'stage': 'error', 'message': message,
                'error_code': error.status_code if isinstance(error, HTTPException) else 504})
    except Exception:
        update({'stage': 'error', 'message': 'Image generation failed. Please try again.', 'error_code': 500})
    finally:
        _tasks.pop(job_id, None)


@app.post('/generations', status_code=202)
async def create_generation(
    file: UploadFile = File(...), yaw: float = Form(0, ge=0, le=360),
    pitch: float = Form(0, ge=-30, le=60), distance: float = Form(1, ge=0.6, le=1.4),
    steps: int = Form(NUM_STEPS, ge=1, le=20),
    guidance_scale: float = Form(GUIDANCE_SCALE, ge=1, le=10),
    seed: int = Form(-1, ge=-1, le=2147483647), prompt: str = Form(''),
    hf_token: Optional[str] = Form(None),
):
    _prune_jobs()
    if len(_tasks) >= MAX_ACTIVE_JOBS:
        raise HTTPException(429, 'The local server is already generating four images. Wait for one to finish.')
    raw = await _read_image(file)
    if len(_tasks) >= MAX_ACTIVE_JOBS:
        raise HTTPException(429, 'The local server is busy. Please try again shortly.')
    job_id = secrets.token_urlsafe(24)
    _jobs[job_id] = {'id': job_id, 'stage': 'connecting',
                     'message': 'Starting image generation…', 'updated': time.monotonic()}
    _tasks[job_id] = asyncio.create_task(_run_job(
        job_id, raw=raw, yaw=yaw, pitch=pitch, distance=distance, steps=steps,
        guidance_scale=guidance_scale, seed=seed, prompt=prompt, hf_token=hf_token,
    ))
    return _job_response(job_id)


@app.get('/generations/{job_id}')
async def generation_status(job_id: str):
    _prune_jobs()
    if job_id not in _jobs:
        raise HTTPException(404, 'This generation expired. Please generate the image again.')
    return _job_response(job_id)


@app.delete('/generations/{job_id}')
async def cancel_generation(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, 'Generation not found.')
    task = _tasks.get(job_id)
    if task is not None:
        _jobs[job_id].update(stage='cancelled', message='Generation cancelled.', updated=time.monotonic())
        task.cancel()
    return _job_response(job_id)


# Retain the original JSON endpoint for existing integrations.
@app.post('/generate', response_model=GenerationResponse)
async def generate_image(
    file: UploadFile = File(...), yaw: float = Form(0, ge=0, le=360),
    pitch: float = Form(0, ge=-30, le=60), distance: float = Form(1, ge=0.6, le=1.4),
    steps: int = Form(NUM_STEPS, ge=1, le=20),
    guidance_scale: float = Form(GUIDANCE_SCALE, ge=1, le=10),
    seed: int = Form(-1, ge=-1, le=2147483647), prompt: str = Form(''),
    hf_token: Optional[str] = Form(None),
):
    raw = await _read_image(file)
    try:
        return await asyncio.wait_for(_generate(
            raw, yaw, pitch, distance, steps, guidance_scale, seed, prompt,
            hf_token, lambda _progress: None,
        ), timeout=GENERATION_TIMEOUT_S)
    except (TimeoutError, asyncio.TimeoutError):
        raise HTTPException(504, 'Image generation timed out. Please try again later.')


@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'Oraa AI Backend', 'generation_api': 'jobs-v1'}
