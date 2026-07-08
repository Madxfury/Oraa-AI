import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Plane, Line, Circle, Torus } from '@react-three/drei';
import { useDrag } from '@use-gesture/react';
import * as THREE from 'three';

function TexturedPlane({ src }: { src: string }) {
    const texture = useLoader(THREE.TextureLoader, src);
    const planeArgs: [number, number] = useMemo(() => {
        const aspect = texture.image.width / texture.image.height;
        if (aspect > 1) {
            return [3, 3 / aspect];
        } else {
            return [3 * aspect, 3];
        }
    }, [texture]);
    return (
        <Plane args={planeArgs}>
            <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
        </Plane>
    );
}

interface CameraControlProps {
    azimuthDeg: number;
    setAzimuthDeg: React.Dispatch<React.SetStateAction<number>>;
    elevationDeg: number;
    setElevationDeg: React.Dispatch<React.SetStateAction<number>>;
    distanceVal: number;
    setDistanceVal: React.Dispatch<React.SetStateAction<number>>;
}

interface Camera3DControlProps extends CameraControlProps {
    inputSrc?: string | null;
}

export function Camera3DControl({
    azimuthDeg, setAzimuthDeg,
    elevationDeg, setElevationDeg,
    distanceVal, setDistanceVal,
    inputSrc
}: Camera3DControlProps) {
    return (
        <div className="absolute inset-0 bg-zinc-950 rounded-xl overflow-hidden">
            {/* Legend Overlay removed based on user request */}

            {/* Floating UI */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-50">
                <div className="bg-black/40 backdrop-blur-md border border-white/5 px-5 py-1.5 rounded-full text-zinc-400 text-xs font-medium tracking-wide shadow-lg">
                    Interactive Viewport
                </div>
            </div>

            <Canvas camera={{ position: [4.5, 3, 4.5], fov: 50 }}>
                <color attach="background" args={['#1a1a1a']} />
                <ambientLight intensity={0.6} color={0xffffff} />
                <directionalLight position={[5, 10, 5]} intensity={0.6} color={0xffffff} />

                <React.Suspense fallback={null}>
                    <Scene
                        azimuthDeg={azimuthDeg} setAzimuthDeg={setAzimuthDeg}
                        elevationDeg={elevationDeg} setElevationDeg={setElevationDeg}
                        distanceVal={distanceVal} setDistanceVal={setDistanceVal}
                        inputSrc={inputSrc}
                    />
                </React.Suspense>

                <OrbitControls makeDefault enablePan={false} enableZoom={false} enableRotate={false} target={[0, 0.75, 0]} />
            </Canvas>
        </div>
    );
}

function Scene({ azimuthDeg, setAzimuthDeg, elevationDeg, setElevationDeg, distanceVal, setDistanceVal, inputSrc }: Camera3DControlProps) {
    const centerHeight = 0.75;
    const baseDistance = 1.6;
    const azimuthRadius = 2.4;
    const elevationRadius = 1.8;

    const [hoveredAzimuth, setHoveredAzimuth] = React.useState(false);
    const [hoveredElevation, setHoveredElevation] = React.useState(false);
    const [hoveredDistance, setHoveredDistance] = React.useState(false);

    React.useEffect(() => {
        document.body.style.cursor = (hoveredAzimuth || hoveredElevation || hoveredDistance) ? 'pointer' : 'auto';
        return () => { document.body.style.cursor = 'auto'; }
    }, [hoveredAzimuth, hoveredElevation, hoveredDistance]);

    const azimuthRad = (azimuthDeg * Math.PI) / 180;
    const elevationRad = (elevationDeg * Math.PI) / 180;
    const distanceValScale = baseDistance * distanceVal;

    const bindGreen = useDrag(({ delta: [dx, dy], event }) => {
        event.stopPropagation();
        setAzimuthDeg((prev: number) => {
            // Camera is at 45° isometric angle → combine dx and dy weighted by
            // how much each screen direction contributes to tangential ring motion.
            // sin(az + PI/4) for dx, and cos(az + PI/4) for dy (approx 1/3 weight).
            const az = (prev * Math.PI) / 180;
            const dAngle = dx * Math.sin(az + Math.PI / 4) + dy * 0.33 * Math.cos(az + Math.PI / 4);
            let newVal = prev + dAngle * 0.6;
            if (newVal < 0) newVal = (newVal % 360) + 360;
            if (newVal >= 360) newVal %= 360;
            return newVal;
        });
    });

    const bindPink = useDrag(({ delta: [, dy], event }) => {
        event.stopPropagation();
        setElevationDeg((p: number) => Math.max(-30, Math.min(60, p - dy * 0.5)));
    });

    const bindYellow = useDrag(({ delta: [dx, dy], event }) => {
        event.stopPropagation();
        setDistanceVal((dist: number) => Math.max(0.6, Math.min(1.4, dist - (dx + dy) * 0.005)));
    });

    const camPos = new THREE.Vector3(
        distanceValScale * Math.sin(azimuthRad) * Math.cos(elevationRad),
        distanceValScale * Math.sin(elevationRad),
        distanceValScale * Math.cos(azimuthRad) * Math.cos(elevationRad)
    );

    const greenPos = new THREE.Vector3(
        azimuthRadius * Math.sin(azimuthRad),
        0.05,
        azimuthRadius * Math.cos(azimuthRad)
    );

    // For elevation Arc (fixed at x=-0.8)
    const arcPoints = useMemo(() => {
        const points = [];
        for (let i = 0; i <= 32; i++) {
            const angle = THREE.MathUtils.degToRad(-30 + (90 * i / 32));
            points.push(new THREE.Vector3(-0.8, elevationRadius * Math.sin(angle), elevationRadius * Math.cos(angle)));
        }
        return points;
    }, [elevationRadius]);

    const elevationCurve = useMemo(() => new THREE.CatmullRomCurve3(arcPoints), [arcPoints]);

    const elevationPos = new THREE.Vector3(
        -0.8,
        elevationRadius * Math.sin(elevationRad),
        elevationRadius * Math.cos(elevationRad)
    );

    const orangeDist = distanceValScale - 0.5;
    const distancePos = new THREE.Vector3(
        orangeDist * Math.sin(azimuthRad) * Math.cos(elevationRad),
        orangeDist * Math.sin(elevationRad),
        orangeDist * Math.cos(azimuthRad) * Math.cos(elevationRad)
    );

    const camRef = useRef<THREE.Group>(null);

    useFrame(() => {
        if (camRef.current) {
            // Look at world-space center (0, 0.75, 0) — the scene center
            camRef.current.lookAt(new THREE.Vector3(0, 0.75, 0));
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const greenDragProps = bindGreen() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinkDragProps = bindPink() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yellowDragProps = bindYellow() as any;

    return (
        <group position={[0, centerHeight, 0]}>
            <gridHelper args={[8, 16, '#333333', '#222222']} position={[0, -centerHeight, 0]} />

            {/* Center Target (Image or Face) */}
            <group scale={0.4}>
                {inputSrc ? (
                    <TexturedPlane src={inputSrc} />
                ) : (
                    <>
                        <Plane args={[3, 3]} material-color="#3a3a4a" />
                        <Circle args={[0.9, 64]} position={[0, 0, 0.01]} material-color="#ffcc99" />
                        <Circle args={[0.1, 32]} position={[-0.3, 0.2, 0.02]} material-color="#333" />
                        <Circle args={[0.1, 32]} position={[0.3, 0.2, 0.02]} material-color="#333" />
                        {/* Smile */}
                        <Torus args={[0.3, 0.04, 16, 32, Math.PI]} position={[0, -0.15, 0.02]} rotation={[0, 0, Math.PI]} material-color="#333" />
                    </>
                )}
            </group>

            {/* Azimuth Ring (Green) */}
            <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[azimuthRadius, 0.04, 16, 64]} />
                <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.3} />
            </mesh>
            <mesh
                {...greenDragProps}
                position={[greenPos.x, 0.05, greenPos.z]}
                scale={hoveredAzimuth ? 1.3 : 1}
                onPointerOver={(e: React.PointerEvent) => { e.stopPropagation(); setHoveredAzimuth(true); }}
                onPointerOut={(e: React.PointerEvent) => { e.stopPropagation(); setHoveredAzimuth(false); }}
            >
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={hoveredAzimuth ? 1 : 0.5} />
            </mesh>

            {/* Elevation Arc (Pink) */}
            <mesh>
                <tubeGeometry args={[elevationCurve, 32, 0.04, 8, false]} />
                <meshStandardMaterial color="#ff69b4" emissive="#ff69b4" emissiveIntensity={0.3} />
            </mesh>
            <mesh
                {...pinkDragProps}
                position={[elevationPos.x, elevationPos.y, elevationPos.z]}
                scale={hoveredElevation ? 1.3 : 1}
                onPointerOver={(e: React.PointerEvent) => { e.stopPropagation(); setHoveredElevation(true); }}
                onPointerOut={(e: React.PointerEvent) => { e.stopPropagation(); setHoveredElevation(false); }}
            >
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshStandardMaterial color="#ff69b4" emissive="#ff69b4" emissiveIntensity={hoveredElevation ? 1 : 0.5} />
            </mesh>

            {/* Camera Model */}
            <group position={[camPos.x, camPos.y, camPos.z]} ref={camRef}>
                <mesh>
                    <boxGeometry args={[0.3, 0.22, 0.38]} />
                    <meshStandardMaterial color="#6699cc" metalness={0.5} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.09, 0.11, 0.18, 16]} />
                    <meshStandardMaterial color="#6699cc" metalness={0.5} roughness={0.3} />
                </mesh>
            </group>

            {/* Distance Control (Orange) */}
            <mesh
                {...yellowDragProps}
                position={[distancePos.x, distancePos.y, distancePos.z]}
                scale={hoveredDistance ? 1.3 : 1}
                onPointerOver={(e: React.PointerEvent) => { e.stopPropagation(); setHoveredDistance(true); }}
                onPointerOut={(e: React.PointerEvent) => { e.stopPropagation(); setHoveredDistance(false); }}
            >
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshStandardMaterial color="#ffa500" emissive="#ffa500" emissiveIntensity={hoveredDistance ? 1 : 0.5} />
            </mesh>

            <Line points={[[0, 0, 0], [camPos.x, camPos.y, camPos.z]]} color="#ffa500" />
        </group>
    );
}
