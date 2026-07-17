from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import base64
import io
import time
import asyncio
import os
import tempfile
import httpx
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

from PIL import Image
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Oraa AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_SIDE     = 1024
JPEG_QUALITY = 90

# Thread pool for blocking Gradio Client calls
_executor = ThreadPoolExecutor(max_workers=4)

HF_SPACE = "multimodalart/qwen-image-multiple-angles-3d-camera"


def prepare_image_bytes(raw: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    if max(w, h) > MAX_SIDE:
        scale = MAX_SIDE / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


class GenerationResponse(BaseModel):
    image_base64: str
    prompt: str
    metadata: dict


# ── HuggingFace Space (primary, FREE) ────────────────────────────────────────

def _call_hf_space_sync(
    image_bytes: bytes,
    azimuth: float,
    elevation: float,
    distance: float,
    seed: int,
    guidance_scale: float,
    num_steps: int,
    hf_token: Optional[str] = None,
) -> dict:
    """
    Synchronous call to the HuggingFace Space gradio API.
    Runs in a thread so it doesn't block FastAPI's event loop.
    """
    from gradio_client import Client, handle_file

    # Write image to a temp file — Gradio Client uses file paths
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        hf_token_resolved = hf_token or os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_CO_TOKEN")
        client = Client(HF_SPACE, token=hf_token_resolved, verbose=False)
        print(f"[hf] Gradio sending tmp file {tmp_path} ...")
        result = client.predict(
            image=handle_file(tmp_path),
            azimuth=float(azimuth),
            elevation=float(elevation),
            distance=float(distance),
            seed=int(seed if seed != -1 else 0),
            randomize_seed=seed == -1,
            guidance_scale=float(guidance_scale),
            num_inference_steps=int(num_steps),
            height=1024,
            width=1024,
            api_name="/infer_camera_edit",
        )
        print(f"[hf] Raw result type: {type(result)}")
        print(f"[hf] Raw result: {str(result)[:500]}")

        # result should be a tuple: (output_image, seed, generated_prompt)
        if isinstance(result, tuple) and len(result) >= 1:
            output_img = result[0]
            used_seed  = result[1] if len(result) > 1 else seed
            gen_prompt = result[2] if len(result) > 2 else ""
        else:
            output_img = result
            used_seed = seed
            gen_prompt = ""

        # output_img can be a string (path to local temp file downloaded by gradio) or a dict
        if isinstance(output_img, dict):
            out_path = output_img.get("path") or output_img.get("url")
        else:
            out_path = str(output_img)

        return {"path": out_path, "seed": used_seed, "prompt": gen_prompt}
    finally:
        os.unlink(tmp_path)


async def call_hf_space(
    image_bytes: bytes,
    azimuth: float,
    elevation: float,
    distance: float,
    seed: int,
    guidance_scale: float,
    num_steps: int,
    hf_token: Optional[str] = None,
) -> dict:
    """Async wrapper around the blocking Gradio Client call."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor,
        _call_hf_space_sync,
        image_bytes, azimuth, elevation, distance, seed, guidance_scale, num_steps, hf_token,
    )


# ── Main endpoint ─────────────────────────────────────────────────────────────

MAX_RETRIES = 2          # total attempts = MAX_RETRIES + 1
RETRY_DELAY_S = 3        # seconds between retries

# Keywords that indicate a transient GPU / quota issue worth retrying
_TRANSIENT_KEYWORDS = ("gpu task aborted", "gpu aborted", "gpu", "quota", "exceeded", "runtime", "zerogpu")


@app.post("/generate", response_model=GenerationResponse)
async def generate_image(
    file: UploadFile = File(...),
    yaw: float = Form(0.0),       # maps to azimuth
    pitch: float = Form(0.0),     # maps to elevation
    distance: float = Form(1.0),
    steps: int = Form(4),
    guidance_scale: float = Form(1.0),
    seed: int = Form(-1),
    prompt: str = Form(""),
    hf_token: Optional[str] = Form(None),
):
    raw_contents = await file.read()
    actual_seed  = seed if seed != -1 else int(time.time() * 1000) % 2147483647

    # Prepare image
    try:
        optimised = prepare_image_bytes(raw_contents)
    except Exception:
        optimised = raw_contents
    print(f"[img] {len(raw_contents)//1024}kB → {len(optimised)//1024}kB")

    # Resolve HF token (UI field wins, then .env default, then default token)
    hf_token_val = (hf_token or "").strip()
    if not hf_token_val:
        hf_token_val = os.getenv("HF_TOKEN", "").strip()

    key_preview = (hf_token_val[:8] + "...") if len(hf_token_val) > 8 else "(none)"
    print(f"[hf_token] {key_preview}  (len={len(hf_token_val)})")

    instruction = f"Change the camera angle: horizontal yaw {yaw}°, vertical pitch {pitch}°. {prompt}".strip()

    # ── Call HuggingFace Space (with retry for transient GPU errors) ─────────
    last_err: Optional[Exception] = None

    for attempt in range(1, MAX_RETRIES + 2):       # 1 … MAX_RETRIES+1
        print(f"[hf] Calling {HF_SPACE} (attempt {attempt}) ...")
        try:
            hf_result = await asyncio.wait_for(
                call_hf_space(
                    optimised,
                    azimuth=yaw,
                    elevation=pitch,
                    distance=distance,
                    seed=actual_seed,
                    guidance_scale=1.0,   # Qwen LoRA uses cfg=1
                    num_steps=4,
                    hf_token=hf_token_val,
                ),
                timeout=180,
            )

            out_path = hf_result.get("path")
            if not out_path:
                raise RuntimeError("No output from HF Space")

            print(f"[hf] ✓ Success on attempt {attempt}: {str(out_path)[:80]}")

            # If it's a local file path read & base64 encode it
            if out_path.startswith("/") or out_path.startswith("C:\\"):
                with open(out_path, "rb") as f:
                    img_bytes = f.read()
                encoded = base64.b64encode(img_bytes).decode("utf-8")
                mime = "image/webp" if out_path.endswith(".webp") else "image/jpeg"
                result_url = f"data:{mime};base64,{encoded}"
            else:
                result_url = out_path   # already a URL

            return {
                "image_base64": result_url,
                "prompt": hf_result.get("prompt", instruction),
                "metadata": {
                    "engine": f"huggingface/{HF_SPACE}",
                    "seed": int(hf_result.get("seed", actual_seed)),
                },
            }

        except asyncio.TimeoutError:
            print("[hf] Timeout after 180s")
            raise HTTPException(status_code=504, detail="HuggingFace Space timed out after 3 minutes. Please try again later.")

        except Exception as hf_err:
            last_err = hf_err
            err_msg = str(hf_err).lower()
            is_transient = any(kw in err_msg for kw in _TRANSIENT_KEYWORDS)

            print(f"[hf] Error (attempt {attempt}, transient={is_transient}): {hf_err}")

            if is_transient and attempt <= MAX_RETRIES:
                print(f"[hf] Retrying in {RETRY_DELAY_S}s ...")
                await asyncio.sleep(RETRY_DELAY_S)
                continue          # retry

            # Non-transient or all retries exhausted
            if is_transient:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "The Hugging Face ZeroGPU GPU was unavailable after multiple attempts "
                        "(GPU task aborted / quota exceeded).\n\n"
                        "This usually means the Space is under heavy load. You can:\n"
                        "1. Wait a minute and try again.\n"
                        "2. Paste your own free Hugging Face token (https://huggingface.co/settings/tokens) "
                        "in the input box above to get your own GPU quota."
                    )
                )
            raise HTTPException(
                status_code=500,
                detail=f"Image generation failed: {hf_err}. Please try again."
            )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Oraa AI Backend"}
