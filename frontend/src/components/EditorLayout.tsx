import { useState } from 'react';
import { Camera3DControl } from './Camera3DControl';
import { SlidersConfiguration } from './SlidersConfiguration';
import { InputImagePanel, OutputImagePanel } from './ImagePreviewPanels';
import { PromptGenerator, generatePromptText } from './PromptGenerator';
import { generateImage } from '../api';
export function EditorLayout() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [inputSrc, setInputSrc] = useState<string | null>(null);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Core parameters state
    const [azimuthDeg, setAzimuthDeg] = useState(0);
    const [elevationDeg, setElevationDeg] = useState(0);
    const [distanceVal, setDistanceVal] = useState(1.0);
    const [hfToken, setHfToken] = useState("");

    const handleGenerate = async () => {
        if (!inputFile) {
            setErrorMsg("Please upload an image first.");
            return;
        }

        setIsGenerating(true);
        setErrorMsg(null);
        setOutputUrl(null);
        const prompt = generatePromptText(azimuthDeg, elevationDeg, distanceVal);

        try {
            const response = await generateImage(
                inputFile,
                azimuthDeg,
                elevationDeg,
                distanceVal,
                24,
                3.5,
                -1,
                prompt,
                hfToken
            );

            if (response.image_base64) {
                setOutputUrl(response.image_base64);
            }
        } catch (error: unknown) {
            console.error("Failed to generate image:", error);
            const err = error as { response?: { data?: { detail?: string } }; message?: string };
            const backendError = err.response?.data?.detail || err.message || "Generation failed. Please try again.";
            setErrorMsg(backendError);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto">
            {/* Error Banner */}
            {errorMsg && (
                <div className="flex items-start gap-3 bg-red-950/60 border border-red-500/30 rounded-2xl px-5 py-4 text-sm text-red-300 w-full max-w-[800px] mx-auto">
                    <span className="text-red-400 mt-0.5">⚠️</span>
                    <span className="flex-1">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="text-red-400/60 hover:text-red-300 text-lg leading-none ml-2">✕</button>
                </div>
            )}
            {/* Top Toolbar (HF Token & Generate) */}
            <div className="flex flex-col sm:flex-row items-end justify-center w-full max-w-[800px] mx-auto mb-4 gap-4 px-4">
                <div className="w-full sm:w-2/3 flex flex-col gap-1.5 pt-2">
                    <label className="text-[11px] font-medium text-zinc-400 tracking-wide text-center sm:text-left ml-2">
                        Hugging Face Token <span className="text-emerald-500 text-[10px]">(default active — paste yours if rate limit is exceeded)</span>
                    </label>
                    <input
                        type="text"
                        placeholder="Paste your Hugging Face Token (hf_...) to bypass default limits"
                        value={hfToken}
                        onChange={(e) => setHfToken(e.target.value)}
                        className="w-full bg-[#111] border border-white/5 rounded-2xl px-5 py-3.5 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all font-mono shadow-inner"
                    />
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full sm:w-1/3 py-3.5 rounded-2xl font-bold text-[15px] bg-white text-black shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 active:scale-[0.99] h-[52px]"
                >
                    {isGenerating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            Wait...
                        </>
                    ) : (
                        <>Generate Angle</>
                    )}
                </button>
            </div>

            {/* 2x2 Layout Grid */}
            <div className="flex flex-col lg:flex-row gap-6 w-full">
                {/* Left Column (Input & 3D Camera) */}
                <div className="w-full lg:w-5/12 flex flex-col gap-6">
                    <InputImagePanel
                        setInputFile={setInputFile}
                        inputSrc={inputSrc}
                        setInputSrc={setInputSrc}
                    />

                    <div className="flex-1 bg-[#09090b] border border-white/5 rounded-2xl overflow-hidden flex flex-col relative min-h-[400px]">
                        <div className="absolute top-5 left-5 z-10">
                            <div className="bg-transparent border border-white/10 rounded-full text-zinc-400 text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                3D CAMERA CONTROL
                            </div>
                        </div>

                        <div className="pt-16 p-6 flex-1 flex flex-col">
                            <p className="text-xs text-zinc-500 mb-5 flex gap-4 items-center flex-wrap">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Azimuth</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400"></span> Elevation</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Distance</span>
                            </p>

                            <div className="h-[300px] md:h-[400px] lg:h-full min-h-[300px] w-full rounded-xl overflow-hidden bg-zinc-950 relative border border-white/5 flex-1 mt-2">
                                <Camera3DControl
                                    azimuthDeg={azimuthDeg} setAzimuthDeg={setAzimuthDeg}
                                    elevationDeg={elevationDeg} setElevationDeg={setElevationDeg}
                                    distanceVal={distanceVal} setDistanceVal={setDistanceVal}
                                    inputSrc={inputSrc}
                                />

                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column (Output & Sliders) */}
                <div className="w-full lg:w-7/12 flex flex-col gap-6">
                    <OutputImagePanel
                        isGenerating={isGenerating}
                        outputUrl={outputUrl}
                    />

                    <div className="bg-[#09090b] border border-white/5 rounded-2xl overflow-hidden flex flex-col relative flex-1 p-6 pt-16">
                        <div className="absolute top-5 left-5 z-10">
                            <div className="bg-transparent border border-white/10 rounded-full text-zinc-400 text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                SLIDER CONTROLS
                            </div>
                        </div>

                        <div className="flex flex-col h-full justify-between">
                            <SlidersConfiguration
                                azimuthDeg={azimuthDeg} setAzimuthDeg={setAzimuthDeg}
                                elevationDeg={elevationDeg} setElevationDeg={setElevationDeg}
                                distanceVal={distanceVal} setDistanceVal={setDistanceVal}
                            />

                            <div className="mt-8 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                                        Active Prompt Parameter
                                    </div>
                                </div>
                                <PromptGenerator
                                    azimuthDeg={azimuthDeg}
                                    elevationDeg={elevationDeg}
                                    distanceVal={distanceVal}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
