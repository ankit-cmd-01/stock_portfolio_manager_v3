import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Sphere } from "@react-three/drei";

import { useIsMobile } from "../../hooks/useIsMobile";
import SectionReveal from "./SectionReveal";

const nodes = [
  { label: "NSE", position: [0.95, 0.3, 0.7] },
  { label: "BSE", position: [-0.92, 0.15, 0.82] },
  { label: "MCX", position: [0.12, -0.88, 0.98] },
];

function GlobeScene() {
  const globeRef = useRef();

  const orbits = useMemo(
    () => [
      [nodes[0].position, [0, 0.5, 1.4], nodes[1].position],
      [nodes[1].position, [-0.2, -0.6, 1.35], nodes[2].position],
      [nodes[2].position, [0.7, -0.2, 1.45], nodes[0].position],
    ],
    []
  );

  useFrame((state) => {
    if (!globeRef.current) {
      return;
    }
    globeRef.current.rotation.y += 0.0035;
    globeRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.45) * 0.08;
    globeRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.3) * 0.04;
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <pointLight position={[5, 3, 4]} intensity={18} color="#00e5ff" />
      <group ref={globeRef} position={[0, -0.05, 0]} scale={1.24}>
        <Sphere args={[1.42, 48, 48]}>
          <meshStandardMaterial color="#121c2f" emissive="#071a2c" emissiveIntensity={0.8} metalness={0.5} roughness={0.45} />
        </Sphere>
        {nodes.map((node) => (
          <mesh key={node.label} position={node.position}>
            <sphereGeometry args={[0.05, 18, 18]} />
            <meshBasicMaterial color="#00e5ff" />
          </mesh>
        ))}
        {orbits.map((points, index) => (
          <Line key={index} points={points} color="#00e5ff" lineWidth={1.2} transparent opacity={0.68} />
        ))}
      </group>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.55} />
    </>
  );
}

function MobileFallback() {
  return (
    <div className="relative h-[20rem] overflow-hidden rounded-[2rem] border border-white/5 bg-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.18),transparent_28%),linear-gradient(180deg,#0a0f1e_0%,#10192b_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-white/[0.03]" />
      {[
        { label: "NSE", left: "58%", top: "34%" },
        { label: "BSE", left: "36%", top: "42%" },
        { label: "MCX", left: "48%", top: "63%" },
      ].map((node) => (
        <div key={node.label} className="absolute" style={{ left: node.left, top: node.top }}>
          <div className="h-3 w-3 rounded-full bg-primary shadow-[0_0_20px_rgba(0,229,255,0.75)]" />
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-primary">{node.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function MarketGlobe3D() {
  const isMobile = useIsMobile();

  return (
    <SectionReveal className="mx-auto max-w-[100rem] px-4 py-14 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-surface p-5 lg:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.32em] text-primary">Market map</p>
          <h3 className="mt-4 font-display text-4xl text-text">Tracking Indian Markets in Real-Time</h3>
        </div>
        <div className="rounded-[1.8rem] border border-white/5 bg-[#091120] p-3">
          {isMobile ? (
            <MobileFallback />
          ) : (
            <div className="h-[28rem]">
              <Canvas camera={{ position: [0, 0, 4.2], fov: 34 }}>
                <Suspense fallback={null}>
                  <GlobeScene />
                </Suspense>
              </Canvas>
            </div>
          )}
        </div>
      </div>
    </SectionReveal>
  );
}
