export interface GenerateResponse {
    image_base64: string;
    prompt: string;
    metadata: {
        steps: number;
        guidance_scale: number;
        seed: number;
        inference_time: number;
    };
}

export const generateImage = async (
    file: File,
    yaw: number,
    pitch: number,
    distance: number,
    steps: number,
    guidance_scale: number,
    seed: number,
    prompt: string,
    hfToken?: string
): Promise<GenerateResponse> => {

    const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://127.0.0.1:8000";
    const backendUrl = rawBackendUrl.replace(/\/+$/, "");
    const endpointUrl = `${backendUrl}/generate`;

    let useBackend = false;
    try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 1200);
        const healthCheck = await fetch(`${backendUrl}/health`, {
            method: "GET",
            signal: controller.signal
        });
        window.clearTimeout(timeoutId);
        if (healthCheck.ok) {
            useBackend = true;
        }
    } catch (e) {
        console.log("Local backend server is not running or unreachable. Falling back to browser-direct execution...");
    }

    const finalPrompt = prompt || `front, eye-level shot, medium shot, azimuth ${yaw} degrees, elevation ${pitch} degrees, camera distance ${distance}`;

    if (useBackend) {
        // --- Option A: Use local Python backend ---
        const formData = new FormData();
        formData.append("file", file);
        formData.append("yaw", yaw.toString());
        formData.append("pitch", pitch.toString());
        formData.append("distance", distance.toString());
        formData.append("steps", steps.toString());
        formData.append("guidance_scale", guidance_scale.toString());
        formData.append("seed", seed.toString());
        formData.append("prompt", finalPrompt);
        if (hfToken) {
            formData.append("hf_token", hfToken);
        }

        try {
            console.log("Calling backend to generate image:", endpointUrl);

            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 150000);

            const response = await fetch(endpointUrl, {
                method: "POST",
                body: formData,
                signal: controller.signal,
            });

            window.clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage = `Server error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorMessage = typeof errorData.detail === 'string'
                            ? errorData.detail
                            : JSON.stringify(errorData.detail);
                    }
                } catch {
                    // Ignore json parse error
                }
                throw new Error(errorMessage);
            }

            const data: GenerateResponse = await response.json();
            return data;
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as any;
            console.error("Backend API Error:", error);

            if (error?.name === "AbortError") {
                throw new Error(`Request timed out. Backend: ${backendUrl}. Try again in a moment.`);
            }
            throw error;
        }
    } else {
        // --- Option B: Direct Browser-to-API Execution ---
        try {
            console.log("Directly calling Hugging Face Space from browser...");
            const { Client } = await import("@gradio/client");
            
            const tokenToUse = (hfToken && hfToken.trim() !== "") 
                ? hfToken.trim() 
                : "";

            const app = await Client.connect(
                "multimodalart/qwen-image-multiple-angles-3d-camera",
                { token: tokenToUse as `hf_${string}` }
            );

            const TRANSIENT_KEYWORDS = ["gpu task aborted", "gpu aborted", "quota", "exceeded", "zerogpu"];
            const MAX_RETRIES = 2;
            const RETRY_DELAY_MS = 3000;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
                try {
                    console.log(`[hf-direct] attempt ${attempt}...`);
                    const result = await app.predict("/infer_camera_edit", [
                        file,                               // image (Blob/File)
                        yaw,                                // azimuth (number)
                        pitch,                              // elevation (number)
                        distance,                           // distance (number)
                        seed === -1 ? 0 : seed,             // seed (number)
                        seed === -1,                        // randomize_seed (boolean)
                        guidance_scale,                     // guidance_scale (number)
                        steps,                              // num_inference_steps (number)
                        1024,                               // height (number)
                        1024                                // width (number)
                    ]);

                    const outputData = result.data as any[];
                    const outputImage = outputData?.[0];
                    const outputImageUrl = outputImage?.url;

                    if (!outputImageUrl) {
                        throw new Error("No image returned from Hugging Face Space.");
                    }

                    return {
                        image_base64: outputImageUrl,
                        prompt: finalPrompt,
                        metadata: {
                            steps,
                            guidance_scale,
                            seed,
                            inference_time: 0
                        }
                    };
                } catch (retryErr: any) {
                    lastError = retryErr;
                    const msg = (retryErr?.message || String(retryErr)).toLowerCase();
                    const isTransient = TRANSIENT_KEYWORDS.some(kw => msg.includes(kw));

                    console.warn(`[hf-direct] Error (attempt ${attempt}, transient=${isTransient}):`, retryErr);

                    if (isTransient && attempt <= MAX_RETRIES) {
                        console.log(`[hf-direct] Retrying in ${RETRY_DELAY_MS}ms...`);
                        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
                        continue;
                    }

                    if (isTransient) {
                        throw new Error(
                            "GPU was unavailable after multiple attempts (GPU task aborted). " +
                            "The Space is under heavy load — wait a minute and try again, or paste your own " +
                            "free HuggingFace token (https://huggingface.co/settings/tokens) to get your own GPU quota."
                        );
                    }

                    throw retryErr;
                }
            }

            // Should never reach here, but just in case
            throw lastError || new Error("Generation failed after all retries.");
        } catch (err: any) {
            console.error("Direct HF Space call failed:", err);
            throw new Error(`Generation failed: ${err.message || err}`);
        }
    }
};
