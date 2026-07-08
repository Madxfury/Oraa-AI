import React from 'react';

interface CameraControlsProps {
    yaw: number;
    pitch: number;
    distance: number;
    onYawChange: (val: number) => void;
    onPitchChange: (val: number) => void;
    onDistanceChange: (val: number) => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
    yaw,
    pitch,
    distance,
    onYawChange,
    onPitchChange,
    onDistanceChange,
}) => {
    return (
        <div className="space-y-6">
            {/* Yaw */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-xs text-gray-300 font-medium">Yaw (Rotation)</label>
                    <span className="text-xs text-primary-500 font-mono">{yaw.toFixed(1)}°</span>
                </div>
                <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={yaw}
                    onChange={(e) => onYawChange(parseFloat(e.target.value))}
                    className="w-full accent-primary-500 bg-dark-700 h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
                    <span>-180°</span>
                    <span>0°</span>
                    <span>180°</span>
                </div>
            </div>

            {/* Pitch */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-xs text-gray-300 font-medium">Pitch (Tilt)</label>
                    <span className="text-xs text-primary-500 font-mono">{pitch.toFixed(1)}°</span>
                </div>
                <input
                    type="range"
                    min="-90"
                    max="90"
                    step="1"
                    value={pitch}
                    onChange={(e) => onPitchChange(parseFloat(e.target.value))}
                    className="w-full accent-primary-500 bg-dark-700 h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
                    <span>-90°</span>
                    <span>0°</span>
                    <span>90°</span>
                </div>
            </div>

            {/* Distance */}
            <div>
                <div className="flex justify-between mb-2">
                    <label className="text-xs text-gray-300 font-medium">Distance (Zoom)</label>
                    <span className="text-xs text-primary-500 font-mono">{distance.toFixed(1)}x</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={distance}
                    onChange={(e) => onDistanceChange(parseFloat(e.target.value))}
                    className="w-full accent-primary-500 bg-dark-700 h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>3.0x</span>
                </div>
            </div>
        </div>
    );
};
