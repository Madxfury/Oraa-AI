/* eslint-disable react-refresh/only-export-components */
interface PromptGeneratorProps {
    azimuthDeg: number;
    elevationDeg: number;
    distanceVal: number;
}

// Snap helper function
function snapToNearest(value: number, steps: number[]) {
    return steps.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
}

// Map Azimuth angles to descriptions based on reference
export const getAzimuthDesc = (deg: number) => {
    const steps = [0, 45, 90, 135, 180, 225, 270, 315];
    const snapped = snapToNearest(deg, steps);
    const map: Record<number, string> = {
        0: 'front view', 45: 'front-right quarter view', 90: 'right side view',
        135: 'back-right quarter view', 180: 'back view', 225: 'back-left quarter view',
        270: 'left side view', 315: 'front-left quarter view'
    };
    return map[snapped];
};

// Map Elevation
export const getElevationDesc = (deg: number) => {
    const steps = [-30, 0, 30, 60];
    const snapped = snapToNearest(deg, steps);
    const map: Record<number, string> = {
        '-30': 'low-angle shot', '0': 'eye-level shot', '30': 'elevated shot', '60': 'high-angle shot'
    };
    return map[snapped];
};

// Map Distance
export const getDistanceDesc = (val: number) => {
    const steps = [0.6, 1.0, 1.4];
    const snapped = snapToNearest(val, steps);
    const map: Record<string, string> = {
        '0.6': 'close-up', '1.0': 'medium shot', '1': 'medium shot', '1.4': 'wide shot'
    };
    const key = snapped === 1 ? '1' : snapped.toFixed(1);
    return map[key];
};

export function generatePromptText(azimuthDeg: number, elevationDeg: number, distanceVal: number) {
    return `<sks> ${getAzimuthDesc(azimuthDeg)} ${getElevationDesc(elevationDeg)} ${getDistanceDesc(distanceVal)}`;
}

export function PromptGenerator({ azimuthDeg, elevationDeg, distanceVal }: PromptGeneratorProps) {
    const promptText = generatePromptText(azimuthDeg, elevationDeg, distanceVal);

    return (
        <div className="bg-[#111113] border border-white/5 rounded-lg p-4">
            <p className="font-mono text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {promptText}
            </p>
        </div>
    );
}
