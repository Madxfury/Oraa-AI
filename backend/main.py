from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import base64
import hashlib
import io
import time
import asyncio
import os
import tempfile
import httpx
from typing import Optional
from collections import OrderedDict
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

# ── GPU-Optimised Settings ────────────────────────────────────────────────────
# Reduced from 1024 → 512 to cut GPU time by ~4×
MAX_SIDE       = 512
JPEG_QUALITY   = 85
OUTPUT_HEIGHT  = 512    # was 1024
OUTPUT_WIDTH   = 512    # was 1024
NUM_STEPS      = 2      # was 4 — Qwen LoRA works well at 2 steps with cfg=1
GUIDANCE_SCALE = 1.0    # Qwen LoRA default

# Thread pool for blocking Gradio Client calls
_executor = ThreadPoolExecutor(max_workers=4)

HF_SPACE = "multimodalart/qwen-image-multiple-angles-3d-camera"

# ── Token Rotation Pool ───────────────────────────────────────────────────────
# Supports comma-separated tokens in HF_TOKENS env var, falls back to HF_TOKEN
_token_pool: list[str] = []
_token_index = 0

def _load_token_pool():
    """Load HF tokens from env. Supports HF_TOKENS (comma-separated) and HF_TOKEN (single)."""
    global _token_pool
    pool_str = os.getenv("HF_TOKENS", "").strip()
    if pool_str:
        _token_pool = [t.strip() for t in pool_str.split(",") if t.strip()]
    if not _token_pool:
        single = os.getenv("HF_TOKEN", "").strip()
        if single:
            _token_pool = [single]
    print(f"[tokens] Loaded {len(_token_pool)} token(s) into rotation pool")

_load_token_pool()

def _next_pool_token() -> Optional[str]:
    """Round-robin through the token pool."""
    global _token_index
    if not _token_pool:
        return None
    token = _token_pool[_token_index % len(_token_pool)]
    _token_index += 1
    return token


# ── In-Memory LRU Cache ──────────────────────────────────────────────────────
CACHE_MAX_SIZE = 20
CACHE_TTL_S    = 1800   # 30 minutes

_cache: OrderedDict[str, dict] = OrderedDict()

def _cache_key(image_bytes: bytes, azimuth: float, elevation: float, distance: float) -> str:
    """Create a deterministic cache key from input image + camera params."""
    h = hashlib.sha256()
    h.update(image_bytes)
    h.update(f"{azimuth:.2f}:{elevation:.2f}:{distance:.2f}".encode())
    return h.hexdigest()

def _cache_get(key: str) -> Optional[dict]:
    """Get a cached result if it exists and hasn't expired."""
    if key in _cache:
        entry = _cache[key]
        if time.time() - entry["_ts"] < CACHE_TTL_S:
            _cache.move_to_end(key)
            print(f"[cache] HIT {key[:12]}...")
            return entry
        else:
            del _cache[key]
            print(f"[cache] EXPIRED {key[:12]}...")
    return None

def _cache_put(key: str, value: dict):
    """Store a result in the cache, evicting oldest if full."""
    value["_ts"] = time.time()
    _cache[key] = value
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX_SIZE:
        evicted_key, _ = _cache.popitem(last=False)
        print(f"[cache] EVICTED {evicted_key[:12]}...")
    print(f"[cache] PUT {key[:12]}... (size={len(_cache)})")


# ── Image Preparation ─────────────────────────────────────────────────────────

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
        print(f"[hf] Gradio sending tmp file {tmp_path} (steps={num_steps}, {OUTPUT_WIDTH}×{OUTPUT_HEIGHT}) ...")
        result = client.predict(
            image=handle_file(tmp_path),
            azimuth=float(azimuth),
            elevation=float(elevation),
            distance=float(distance),
            seed=int(seed if seed != -1 else 0),
            randomize_seed=seed == -1,
            guidance_scale=float(guidance_scale),
            num_inference_steps=int(num_steps),
            height=OUTPUT_HEIGHT,
            width=OUTPUT_WIDTH,
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
    steps: int = Form(2),         # default lowered from 4 → 2
    guidance_scale: float = Form(1.0),
    seed: int = Form(-1),
    prompt: str = Form(""),
    hf_token: Optional[str] = Form(None),
):
    raw_contents = await file.read()
    actual_seed  = seed if seed != -1 else int(time.time() * 1000) % 2147483647

    # Prepare image (now caps at 512px)
    try:
        optimised = prepare_image_bytes(raw_contents)
    except Exception:
        optimised = raw_contents
    print(f"[img] {len(raw_contents)//1024}kB → {len(optimised)//1024}kB")

    # ── Check cache first ────────────────────────────────────────────────────
    ckey = _cache_key(optimised, yaw, pitch, distance)
    cached = _cache_get(ckey)
    if cached:
        return {
            "image_base64": cached["image_base64"],
            "prompt": cached["prompt"],
            "metadata": {**cached["metadata"], "cached": True},
        }

    # ── Resolve HF token ─────────────────────────────────────────────────────
    # Priority: user-pasted token > rotation pool > .env single token
    hf_token_val = (hf_token or "").strip()
    if not hf_token_val:
        hf_token_val = _next_pool_token() or ""

    key_preview = (hf_token_val[:8] + "...") if len(hf_token_val) > 8 else "(none)"
    print(f"[hf_token] {key_preview}  (len={len(hf_token_val)}, pool_size={len(_token_pool)})")

    instruction = f"Change the camera angle: horizontal yaw {yaw}°, vertical pitch {pitch}°. {prompt}".strip()

    # ── Call HuggingFace Space (with retry for transient GPU errors) ─────────
    last_err: Optional[Exception] = None

    for attempt in range(1, MAX_RETRIES + 2):       # 1 … MAX_RETRIES+1
        # On retry, try a different token from the pool
        if attempt > 1 and not (hf_token or "").strip():
            hf_token_val = _next_pool_token() or hf_token_val
            print(f"[hf] Rotating to next token: {hf_token_val[:8]}...")

        print(f"[hf] Calling {HF_SPACE} (attempt {attempt}, steps={NUM_STEPS}, {OUTPUT_WIDTH}×{OUTPUT_HEIGHT}) ...")
        try:
            hf_result = await asyncio.wait_for(
                call_hf_space(
                    optimised,
                    azimuth=yaw,
                    elevation=pitch,
                    distance=distance,
                    seed=actual_seed,
                    guidance_scale=GUIDANCE_SCALE,
                    num_steps=NUM_STEPS,
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

            response_data = {
                "image_base64": result_url,
                "prompt": hf_result.get("prompt", instruction),
                "metadata": {
                    "engine": f"huggingface/{HF_SPACE}",
                    "seed": int(hf_result.get("seed", actual_seed)),
                    "steps": NUM_STEPS,
                    "resolution": f"{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}",
                },
            }

            # Store in cache
            _cache_put(ckey, response_data)

            return response_data

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
