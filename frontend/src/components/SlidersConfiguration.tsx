import React from 'react';

interface SlidersConfigurationProps {
    azimuthDeg: number;
    setAzimuthDeg: React.Dispatch<React.SetStateAction<number>>;
    elevationDeg: number;
    setElevationDeg: React.Dispatch<React.SetStateAction<number>>;
    distanceVal: number;
    setDistanceVal: React.Dispatch<React.SetStateAction<number>>;
}

export function SlidersConfiguration({
    azimuthDeg, setAzimuthDeg,
    elevationDeg, setElevationDeg,
    distanceVal, setDistanceVal
}: SlidersConfigurationProps) {

    // Gradio-like slider thumb styling, softened for new UI
    const thumbStyle = `
        input[type=range] {
            -webkit-appearance: none;
            width: 100%;
            background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 14px;
            width: 14px;
            border-radius: 50%;
            background: #ffffff;
            cursor: pointer;
            margin-top: -5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.1s;
        }
        input[type=range]::-webkit-slider-thumb:hover {
            transform: scale(1.1);
        }
        input[type=range]::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            cursor: pointer;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
        }
    `;

    return (
        <div className="flex flex-col gap-8">
            <style>{thumbStyle}</style>

            {/* Azimuth Slider */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start mb-1">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                            <span className="text-zinc-200 text-[11px] font-medium uppercase tracking-widest">Azimuth (Horizontal Selection)</span>
                        </div>
                        <p className="text-zinc-500 text-[10px] sm:text-[11px] font-medium tracking-wide pb-1">0°=FRONT, 90°=RIGHT, 180°=BACK, 270°=LEFT</p>
                    </div>

                    <div className="flex bg-black/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur-md">
                        <input
                            type="number"
                            className="w-14 bg-transparent text-zinc-300 text-xs font-mono text-center outline-none py-1.5"
                            value={Math.round(azimuthDeg)}
                            onChange={(e) => setAzimuthDeg(Math.min(315, Math.max(0, Number(e.target.value))))}
                            min="0" max="315"
                        />
                        <button
                            className="bg-white/5 px-2 hover:bg-white/10 transition-colors border-l border-white/5 text-zinc-500 hover:text-zinc-300 text-xs"
                            onClick={() => setAzimuthDeg(90)}
                            title="Reset to Right Side"
                        >
                            ↺
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full px-1">
                    <span className="text-[10px] font-medium text-zinc-600 w-4">0</span>
                    <div className="relative flex-1 flex items-center h-6">
                        {/* Custom Track Fill */}
                        <div
                            className="absolute left-0 h-1 bg-emerald-400 rounded-l pointer-events-none z-0"
                            style={{ width: `${Math.min(100, Math.max(0, (azimuthDeg / 315) * 100))}%` }}
                        />
                        <input
                            type="range"
                            min="0" max="315" step="1"
                            value={azimuthDeg}
                            onChange={(e) => setAzimuthDeg(Number(e.target.value))}
                            className="absolute inset-0 w-full z-10 m-0"
                        />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-600 w-6">315</span>
                </div>
            </div>

            {/* Elevation Slider */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start mb-1">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.5)]" style={{ background: '#ff69b4' }}></span>
                            <span className="text-zinc-200 text-[11px] font-medium uppercase tracking-widest">Elevation (Vertical Angle)</span>
                        </div>
                        <p className="text-zinc-500 text-[10px] sm:text-[11px] font-medium tracking-wide pb-1">-30°=LOW ANGLE, 0°=EYE LEVEL, 60°=HIGH ANGLE</p>
                    </div>

                    <div className="flex bg-black/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur-md">
                        <input
                            type="number"
                            className="w-14 bg-transparent text-zinc-300 text-xs font-mono text-center outline-none py-1.5"
                            value={Math.round(elevationDeg)}
                            onChange={(e) => setElevationDeg(Math.min(60, Math.max(-30, Number(e.target.value))))}
                            min="-30" max="60"
                        />
                        <button
                            className="bg-white/5 px-2 hover:bg-white/10 transition-colors border-l border-white/5 text-zinc-500 hover:text-zinc-300 text-xs"
                            onClick={() => setElevationDeg(0)}
                            title="Reset to Eye Level"
                        >
                            ↺
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full px-1">
                    <span className="text-[10px] font-medium text-zinc-600 w-4">-30</span>
                    <div className="relative flex-1 flex items-center h-6">
                        {/* Custom Track Fill */}
                        <div
                            className="absolute left-0 h-1 rounded-l pointer-events-none z-0" style={{ background: '#ff69b4', width: `${((elevationDeg + 30) / 90) * 100}%` }}
                        />
                        <input
                            type="range"
                            min="-30" max="60" step="1"
                            value={elevationDeg}
                            onChange={(e) => setElevationDeg(Number(e.target.value))}
                            className="absolute inset-0 w-full z-10 m-0"
                        />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-600 w-6">60</span>
                </div>
            </div>

            {/* Distance Slider */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start mb-1">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>
                            <span className="text-zinc-200 text-[11px] font-medium uppercase tracking-widest">DISTANCE</span>
                        </div>
                        <p className="text-zinc-500 text-[10px] sm:text-[11px] font-medium tracking-wide pb-1">0.6=CLOSE-UP, 1.0=MEDIUM, 1.4=WIDE</p>
                    </div>

                    <div className="flex bg-black/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur-md">
                        <input
                            type="number"
                            className="w-14 bg-transparent text-zinc-300 text-xs font-mono text-center outline-none py-1.5"
                            value={distanceVal.toFixed(1)}
                            onChange={(e) => setDistanceVal(Math.min(1.4, Math.max(0.6, Number(e.target.value))))}
                            min="0.6" max="1.4" step="0.1"
                        />
                        <button
                            className="bg-white/5 px-2 hover:bg-white/10 transition-colors border-l border-white/5 text-zinc-500 hover:text-zinc-300 text-xs"
                            onClick={() => setDistanceVal(1.0)}
                            title="Reset to Medium"
                        >
                            ↺
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full px-1">
                    <span className="text-[10px] font-medium text-zinc-600 w-4">0.6</span>
                    <div className="relative flex-1 flex items-center h-6">
                        {/* Custom Track Fill */}
                        <div
                            className="absolute left-0 h-1 bg-amber-400 rounded-l pointer-events-none z-0"
                            style={{ width: `${((distanceVal - 0.6) / 0.8) * 100}%` }}
                        />
                        <input
                            type="range"
                            min="0.6" max="1.4" step="0.05"
                            value={distanceVal}
                            onChange={(e) => setDistanceVal(Number(e.target.value))}
                            className="absolute inset-0 w-full z-10 m-0"
                        />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-600 w-6">1.4</span>
                </div>
            </div>

        </div>
    );
}
