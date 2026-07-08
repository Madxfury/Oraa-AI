import { useRef, useState, useEffect, useCallback } from 'react';

export interface InputImagePanelProps {
    setInputFile: React.Dispatch<React.SetStateAction<File | null>>;
    inputSrc: string | null;
    setInputSrc: React.Dispatch<React.SetStateAction<string | null>>;
}

export function InputImagePanel({ setInputFile, inputSrc, setInputSrc }: InputImagePanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const stopCamera = useCallback(() => {
        setStream(currentStream => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            return null;
        });
        setIsCameraOpen(false);
    }, []);

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    useEffect(() => {
        if (isCameraOpen && stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [isCameraOpen, stream]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            stopCamera();
            setInputFile(file);
            const tempUrl = URL.createObjectURL(file);
            setInputSrc(tempUrl);
        }
    };

    const startCamera = async () => {
        try {
            setInputSrc(null);
            setInputFile(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setStream(mediaStream);
            setIsCameraOpen(true);
        } catch (error) {
            console.error("Error accessing webcam:", error);
            alert("Could not access your camera. Please check permissions.");
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');

            if (context) {
                // Flip the context horizontally so the captured image matches the mirrored preview
                context.save();
                context.translate(canvas.width, 0);
                context.scale(-1, 1);
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                context.restore();

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
                        setInputFile(file);
                        const tempUrl = URL.createObjectURL(file);
                        setInputSrc(tempUrl);
                        stopCamera();
                    }
                }, "image/jpeg", 0.95);
            }
        }
    };

    return (
        <div className="bg-[#09090b] border border-white/5 rounded-2xl overflow-hidden flex flex-col relative h-[300px] md:h-[400px]">
            <div className="absolute top-5 left-5 z-20">
                <div className="bg-transparent border border-white/10 rounded-full text-zinc-400 text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 flex items-center bg-black/40 backdrop-blur-md">
                    INPUT IMAGE
                </div>
            </div>

            <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-md transition-colors border border-white/10"><span className="text-zinc-300 text-xs">⤢</span></button>
                <button className="bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-md transition-colors border border-white/10" onClick={() => { setInputSrc(null); setInputFile(null); stopCamera(); }}><span className="text-zinc-300 text-xs">✕</span></button>
            </div>

            <div
                className={`flex-1 w-full relative bg-zinc-950 overflow-hidden flex items-center justify-center p-8 ${!inputSrc && !isCameraOpen ? 'cursor-pointer hover:bg-zinc-900 transition-colors' : ''}`}
                onClick={() => { if (!inputSrc && !isCameraOpen) fileInputRef.current?.click(); }}
            >
                <canvas ref={canvasRef} className="hidden" />

                {inputSrc ? (
                    <img src={inputSrc} alt="Input source" className="w-full h-full object-contain drop-shadow-2xl relative z-10" />
                ) : !isCameraOpen ? (
                    <div className="flex flex-col items-center text-zinc-500 relative z-10 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-zinc-800/50 border border-white/5 flex items-center justify-center mb-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <span className="text-sm font-medium">Click to upload image</span>
                    </div>
                ) : null}

                {isCameraOpen && (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center z-30 bg-zinc-950">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                            style={{ transform: "scaleX(-1)" }}
                        />
                        <div className="absolute bottom-6 flex gap-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                                className="bg-white hover:bg-zinc-200 text-black px-6 py-2.5 rounded-full font-bold shadow-2xl transition-transform active:scale-95 flex items-center gap-2"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                                Capture Image
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`h-14 bg-[#09090b] border-t border-white/5 flex items-center justify-center gap-4 sm:gap-8 ${isCameraOpen ? 'opacity-50 pointer-events-none' : ''} text-zinc-400 text-xs font-medium tracking-wide relative`}>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                />
                <button
                    className="hover:text-zinc-100 transition-colors flex items-center gap-2"
                    onClick={() => { stopCamera(); fileInputRef.current?.click(); }}
                >
                    Upload
                </button>
                <button
                    className="hover:text-zinc-100 transition-colors flex items-center gap-2"
                    onClick={() => { if (isCameraOpen) stopCamera(); else startCamera(); }}
                >
                    Camera
                </button>
                <button
                    className="hover:text-red-500 transition-colors flex items-center gap-2"
                    onClick={() => { setInputSrc(null); setInputFile(null); stopCamera(); }}
                >
                    Clear
                </button>
            </div>
        </div>
    );
}

const HINTS = [
    'Analyzing composition…',
    'Adjusting camera angle…',
    'Synthesizing view…',
    'Refining details…',
    'Almost there…',
];

function ProcessingAnimation({ elapsedSeconds }: { elapsedSeconds: number }) {
    const hint = HINTS[Math.floor(elapsedSeconds / 4) % HINTS.length];

    return (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center overflow-hidden">



            {/* Main spinner cluster */}
            <div className="relative z-10 flex flex-col items-center gap-5">
                <div className="relative w-24 h-24 flex items-center justify-center">

                    {/* Outer ring — slow clockwise */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96"
                        style={{ animation: 'spin 3s linear infinite' }}>
                        <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                        <circle cx="48" cy="48" r="44" fill="none" stroke="white" strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeDasharray="48 230"
                            strokeDashoffset="0"
                            style={{ opacity: 0.7 }} />
                    </svg>

                    {/* Middle ring — faster counter-clockwise, subtle teal tint */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96"
                        style={{ animation: 'spin-reverse 2s linear infinite' }}>
                        <circle cx="48" cy="48" r="34" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
                        <circle cx="48" cy="48" r="34" fill="none" stroke="rgba(200,220,255,0.55)" strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeDasharray="30 184"
                            strokeDashoffset="30" />
                    </svg>

                    {/* Inner ring — fastest clockwise */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96"
                        style={{ animation: 'spin 1.2s linear infinite' }}>
                        <circle cx="48" cy="48" r="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
                        <circle cx="48" cy="48" r="22" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeDasharray="16 122" />
                    </svg>

                    {/* Center pulsing dot */}
                    <div
                        className="w-2 h-2 rounded-full bg-white"
                        style={{ animation: 'pulse 1.5s ease-in-out infinite', boxShadow: '0 0 8px 3px rgba(255,255,255,0.3)' }}
                    />

                    {/* Orbiting dot on outer ring */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 96 96"
                        style={{ animation: 'spin 3s linear infinite' }}>
                        <circle cx="48" cy="4" r="2.5" fill="white" opacity="0.9" />
                    </svg>
                </div>

                {/* Label + hint */}
                <div className="flex flex-col items-center gap-1.5">
                    <span
                        className="text-white text-[11px] font-semibold uppercase tracking-[0.25em]"
                        style={{ opacity: 0.9 }}
                    >
                        Processing
                    </span>
                    <span
                        key={hint}
                        className="text-zinc-500 text-[10px] tracking-wide transition-all duration-700"
                        style={{ minWidth: '140px', textAlign: 'center' }}
                    >
                        {hint}
                    </span>
                </div>
            </div>

            {/* Elapsed timer badge */}
            <div className="absolute bottom-5 right-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                <span className="text-zinc-300 font-mono text-[10px] tracking-wider">{elapsedSeconds}s elapsed</span>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes spin-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
            `}</style>
        </div>
    );
}

export interface OutputImagePanelProps {
    isGenerating: boolean;
    outputUrl: string | null;
}

export function OutputImagePanel({ isGenerating, outputUrl }: OutputImagePanelProps) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (isGenerating) {
            setIsImageLoading(true);
            setElapsedSeconds(0);
        }
    }, [isGenerating]);

    const showLoadingState = isGenerating || (!!outputUrl && isImageLoading);

    useEffect(() => {
        let interval: number;
        if (showLoadingState) {
            interval = window.setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => window.clearInterval(interval);
    }, [showLoadingState]);

    const handleDownload = async () => {
        if (!outputUrl) return;
        try {
            const response = await fetch(outputUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oraa-output-${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            window.open(outputUrl, '_blank');
        }
    };

    return (
        <>
            {/* Fullscreen Modal */}
            {isFullscreen && outputUrl && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-md"
                    onClick={() => setIsFullscreen(false)}
                >
                    <button
                        className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 border border-white/10 text-white p-2.5 rounded-full transition-colors"
                        onClick={() => setIsFullscreen(false)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                    <img
                        src={outputUrl}
                        alt="Full screen output"
                        className="max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="bg-[#09090b] border border-white/5 rounded-2xl overflow-hidden flex flex-col group relative h-[300px] md:h-[400px]">
                <div className="absolute top-5 left-5 z-10 transition-opacity">
                    <div className="bg-transparent border border-white/10 rounded-full text-zinc-400 text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 flex items-center">
                        OUTPUT RESULT
                    </div>
                </div>

                {/* Action Buttons — only visible when output is ready */}
                {outputUrl && !showLoadingState && (
                    <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Fullscreen */}
                        <button
                            onClick={() => setIsFullscreen(true)}
                            className="bg-black/40 hover:bg-black/70 p-2 rounded-full backdrop-blur-md transition-colors border border-white/10"
                            title="View fullscreen"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                        </button>
                        {/* Download */}
                        <button
                            onClick={handleDownload}
                            className="bg-black/40 hover:bg-black/70 p-2 rounded-full backdrop-blur-md transition-colors border border-white/10"
                            title="Download image"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                    </div>
                )}

                <div className="flex-1 w-full relative bg-zinc-950 overflow-hidden flex items-center justify-center p-8">
                    {/* Output Image */}
                    {outputUrl && (
                        <img
                            src={outputUrl}
                            alt="Generated output"
                            className={`w-full h-full object-contain drop-shadow-2xl transition-all duration-700 ${showLoadingState ? 'opacity-0 absolute hidden' : 'opacity-100'}`}
                            onLoad={() => setIsImageLoading(false)}
                            onError={() => setIsImageLoading(false)}
                        />
                    )}

                    {!outputUrl && !showLoadingState && (
                        <div className="flex flex-col items-center text-zinc-600 gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                                <span className="text-[15px]">✧</span>
                            </div>
                            <span className="text-[13px] font-medium text-zinc-500">Awaiting generation</span>
                        </div>
                    )}

                    {showLoadingState && (
                        <ProcessingAnimation elapsedSeconds={elapsedSeconds} />
                    )}
                </div>
            </div>
        </>
    );
}

