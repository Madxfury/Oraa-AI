import { useEffect, useRef, useState } from 'react';
import { Loader2, Square, Zap, Sparkles } from 'lucide-react';
import { Camera3DControl } from './Camera3DControl';
import { SlidersConfiguration } from './SlidersConfiguration';
import { InputImagePanel, OutputImagePanel } from './ImagePreviewPanels';
import { generatePreview, resetPreview } from '../preview/client';
import type { GenerationProgress, GenerationQuality } from '../generation';
export function EditorLayout() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [inputSrc, setInputSrc] = useState<string | null>(null);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [progress, setProgress] = useState<GenerationProgress | null>(null);
    const [quality, setQuality] = useState<GenerationQuality>('fast');
    const activeRequest = useRef<AbortController | null>(null);

    useEffect(() => () => { activeRequest.current?.abort(); resetPreview(); }, []);

    // Core parameters state
    const [azimuthDeg, setAzimuthDeg] = useState(0);
    const [elevationDeg, setElevationDeg] = useState(0);
    const [distanceVal, setDistanceVal] = useState(1.0);
    const [outputNotice, setOutputNotice] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (activeRequest.current) return;
        if (!inputFile) {
            setErrorMsg("Please upload an image first.");
            return;
        }

        const controller = new AbortController();
        activeRequest.current = controller;
        setIsGenerating(true);
        setErrorMsg(null);
        setOutputUrl(null);
        setOutputNotice(null);

        try {
            const response = await generatePreview(inputFile, {
                yaw: azimuthDeg, pitch: elevationDeg, distance: distanceVal,
            }, { signal: controller.signal, onProgress: setProgress, quality });
            setOutputUrl(response.imageUrl);
            setOutputNotice(response.notice);
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            console.error("Failed to create preview:", error);
            const err = error as { response?: { data?: { detail?: string } }; message?: string };
            const previewError = err.response?.data?.detail || err.message || "Could not create the preview. Please try again.";
            setErrorMsg(previewError);
        } finally {
            activeRequest.current = null;
            setProgress(null);
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
            {/* Preview toolbar */}
            <div className="flex flex-col w-full max-w-[800px] mx-auto mb-4 gap-3 px-4">
                <div className="flex flex-col sm:flex-row items-end gap-3 sm:gap-4">
                    <div className="w-full sm:flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-300">Private browser previews</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-400">No API key or GPU queue. Your image stays on your device.</p>
                    </div>
                    <div className="w-full sm:w-[240px] shrink-0 h-[52px]">
                    {isGenerating ? (
                        <div className="h-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] pl-4 pr-1.5">
                            <span role="status" className="flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-300">
                                <Loader2 aria-hidden="true" className="w-4 h-4 shrink-0 animate-spin text-emerald-400" />
                                Processing
                            </span>
                            <button
                                type="button"
                                aria-label="Cancel generation"
                                onClick={() => activeRequest.current?.abort(new DOMException('Generation cancelled.', 'AbortError'))}
                                className="h-10 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 text-xs font-semibold text-rose-300 transition-colors hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:bg-rose-500/25"
                            >
                                <Square aria-hidden="true" className="h-3 w-3 fill-current" />
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleGenerate}
                            className="w-full h-full rounded-2xl font-bold text-[15px] bg-white text-black shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-2 hover:bg-zinc-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                        >
                            Create Preview
                        </button>
                    )}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div role="group" aria-label="Generation speed" className="inline-flex w-fit gap-1 rounded-xl border border-white/10 bg-[#111] p-1">
                        {(['fast', 'balanced'] as const).map(mode => (
                            <button
                                key={mode}
                                type="button"
                                aria-pressed={quality === mode}
                                disabled={isGenerating}
                                onClick={() => setQuality(mode)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed ${quality === mode ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-500 hover:text-zinc-200'}`}
                            >
                                {mode === 'fast' ? <Zap aria-hidden="true" className="w-3.5 h-3.5" /> : <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />}
                                {mode === 'fast' ? 'Fast · 384px' : 'Balanced · 512px'}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                        {quality === 'fast' ? 'Smaller previews; depth is reused for later angles.' : 'More detail in your perspective preview.'}
                    </p>
                </div>
            </div>

            <p className="max-w-[800px] mx-auto px-4 text-xs leading-relaxed text-zinc-400">
                Small perspective shifts only: ±15° horizontal and ±10° vertical. This reprojects visible pixels;
                it cannot generate unseen sides or back views. First use downloads a free depth model.
            </p>

            {/* 2x2 Layout Grid */}
            <div className="flex flex-col lg:flex-row gap-6 w-full">
                {/* Left Column (Input & 3D Camera) */}
                <div className="w-full lg:w-5/12 flex flex-col gap-6">
                    <InputImagePanel
                        setInputFile={value => {
                            activeRequest.current?.abort(new DOMException('Image changed.', 'AbortError'));
                            resetPreview();
                            setInputFile(value);
                            setOutputUrl(null);
                            setOutputNotice(null);
                        }}
                        inputSrc={inputSrc}
                        setInputSrc={setInputSrc}
                    />

                    <div className="flex-1 bg-[#09090b] border border-white/5 rounded-2xl overflow-hidden flex flex-col relative min-h-[400px]">
                        <div className="absolute top-4 sm:top-5 left-4 sm:left-5 z-10">
                            <div className="bg-transparent border border-white/10 rounded-full text-zinc-400 text-[9px] sm:text-[10px] font-medium uppercase tracking-widest px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                3D CAMERA CONTROL
                            </div>
                        </div>

                        <div className="pt-14 sm:pt-16 p-4 sm:p-6 flex-1 flex flex-col">
                            <p className="text-[11px] text-zinc-500 mb-5 flex gap-3 sm:gap-4 items-center flex-wrap">
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400"></span> Azimuth</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-400"></span> Elevation</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400"></span> Distance</span>
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
                        generationMessage={progress?.message}
                        outputNotice={outputNotice}
                    />

                    <div className="bg-[#09090b] border border-white/5 rounded-2xl overflow-hidden flex flex-col relative flex-1 p-4 sm:p-6 pt-14 sm:pt-16">
                        <div className="absolute top-4 sm:top-5 left-4 sm:left-5 z-10">
                            <div className="bg-transparent border border-white/10 rounded-full text-zinc-400 text-[9px] sm:text-[10px] font-medium uppercase tracking-widest px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2">
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

                            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                                        Preview Camera
                                    </div>
                                </div>
                                <p className="font-mono text-xs text-zinc-300 bg-white/5 rounded-lg p-4">
                                    Horizontal {azimuthDeg.toFixed(0)}° · Vertical {elevationDeg.toFixed(0)}° · Distance {distanceVal.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
