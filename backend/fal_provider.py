"""Optional dedicated inference, enabled only by IMAGE_PROVIDER=fal."""
import asyncio
import base64
import io
import os
from typing import Callable

import fal_client
import httpx
from fastapi import HTTPException
from PIL import Image

MODEL = 'fal-ai/qwen-image-edit-2511-multiple-angles'


async def call_fal(image_bytes: bytes, parameters: dict, on_progress: Callable[[dict], None]) -> dict:
    if not os.getenv('FAL_KEY', '').strip():
        raise HTTPException(503, 'The fal provider needs FAL_KEY in backend/.env. Set IMAGE_PROVIDER=huggingface to use the free Spaces instead.')
    handle = None
    completed = False
    # HF and fal use different distance scales. parameters.distance is normalized
    # to the HF Space's three supported camera distances.
    zoom = {0.6: 10, 1.0: 5, 1.8: 0}[parameters['distance']]
    arguments = {
        'image_urls': ['data:image/jpeg;base64,' + base64.b64encode(image_bytes).decode()],
        'horizontal_angle': parameters['azimuth'],
        'vertical_angle': parameters['elevation'],
        'zoom': zoom,
        'image_size': {'width': parameters['width'], 'height': parameters['height']},
        'seed': parameters['seed'],
        'num_inference_steps': parameters['num_inference_steps'],
        'guidance_scale': parameters['guidance_scale'],
        'num_images': 1, 'output_format': 'png', 'acceleration': 'regular',
    }
    try:
        handle = await asyncio.wait_for(fal_client.submit_async(MODEL, arguments=arguments), timeout=15)
        while True:
            status = await asyncio.wait_for(handle.status(), timeout=15)
            if isinstance(status, fal_client.Completed):
                break
            if isinstance(status, fal_client.Queued):
                on_progress({'stage': 'queued', 'message': f'Waiting for GPU — queue position {status.position + 1}.',
                             'queue_position': status.position})
            else:
                on_progress({'stage': 'generating', 'message': 'Generating your camera view…'})
            await asyncio.sleep(1)
        result = await asyncio.wait_for(handle.get(), timeout=15)
        images = result.get('images') or []
        if not images or not images[0].get('url'):
            raise RuntimeError('The fal provider returned no image.')
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(images[0]['url'])
            response.raise_for_status()
        raw = response.content
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            mime = Image.MIME.get(image.format, 'image/png')
        completed = True
        return {'image_base64': f'data:{mime};base64,' + base64.b64encode(raw).decode(),
                'seed': result.get('seed', parameters['seed']), 'prompt': result.get('prompt', '')}
    finally:
        if handle is not None and not completed:
            # Queue cancellation cannot interrupt a GPU inference already in progress.
            try:
                await asyncio.wait_for(handle.cancel(), timeout=5)
            except (Exception, asyncio.CancelledError):
                pass
