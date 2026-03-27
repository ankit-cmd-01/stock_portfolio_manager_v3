import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Grid, Plane, PointMaterial, Points, Text } from "@react-three/drei";
import { ArrowRight, Layers3, Radar, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { useIsMobile } from "../../hooks/useIsMobile";
import TickerStrip from "./TickerStrip";

const ribbonRows = [
  { label: "TCS +1.2%", color: "#00e676", y: 1.4, speed: 0.011, offset: 0 },
  { label: "INFY -0.8%", color: "#ff5468", y: 0.65, speed: 0.014, offset: 2.4 },
  { label: "RELIANCE +0.6%", color: "#00e5ff", y: -0.1, speed: 0.01, offset: -1.8 },
];

function DriftField() {
  const pointsRef = useRef();
  const positions = useMemo(() => {
    const values = new Float32Array(2000 * 3);
    for (let index = 0; index < 2000; index += 1) {
      const stride = index * 3;
      values[stride] = (Math.random() - 0.5) * 16;
      values[stride + 1] = (Math.random() - 0.5) * 9;
      values[stride + 2] = (Math.random() - 0.5) * 8;
    }
    return values;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) {
      return;
    }
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.025;
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.08;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color="#00e5ff" size={0.035} sizeAttenuation depthWrite={false} />
    </Points>
  );
}

function TickerRibbon({ label, color, y, speed, offset }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.position.x -= speed;
    if (groupRef.current.position.x < -6.6) {
      groupRef.current.position.x = 6.6;
    }
  });

  return (
    <group ref={groupRef} position={[offset, y, -1.2]}>
      <Plane args={[3.8, 0.32]}>
        <meshStandardMaterial color="#111827" emissive="#062d37" emissiveIntensity={0.8} metalness={0.55} roughness={0.22} />
      </Plane>
      <Text position={[0, 0, 0.02]} fontSize={0.12} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function HeroScene() {
  return (
    <>
      <color attach="background" args={["#0a0f1e"]} />
      <fog attach="fog" args={["#0a0f1e", 5, 16]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[4, 4, 4]} intensity={18} color="#00e5ff" />
      <pointLight position={[-4, 1, 2]} intensity={8} color="#143b60" />
      <DriftField />
      <Grid
        args={[18, 18]}
        position={[0, -2.1, 0]}
        cellColor="#19304a"
        sectionColor="#00e5ff"
        cellSize={0.45}
        sectionSize={2.2}
        infiniteGrid
        fadeDistance={24}
        fadeStrength={1.2}
      />
      {ribbonRows.map((ribbon) => (
        <TickerRibbon key={ribbon.label} {...ribbon} />
      ))}
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.35}>
        <mesh position={[2.5, 1.4, -0.8]}>
          <icosahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.1} roughness={0.18} metalness={0.7} />
        </mesh>
      </Float>
    </>
  );
}

function MobileFallback() {
  return (
    <div className="relative h-[22rem] overflow-hidden rounded-[2rem] border border-border bg-surface">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.18),transparent_22%),radial-gradient(circle_at_80%_28%,rgba(0,229,255,0.08),transparent_18%),linear-gradient(180deg,#0c1426_0%,#0a0f1e_100%)]" />
      <div className="absolute inset-x-6 top-7 space-y-4">
        {["TCS +1.2%", "INFY -0.8%", "RELIANCE +0.6%"].map((item, index) => (
          <div
            key={item}
            className="rounded-full border border-primary/20 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary"
            style={{ transform: `translateX(${index * 26}px)` }}
          >
            {item}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent_0%,rgba(0,229,255,0.04)_25%,rgba(13,25,46,0.92)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(90deg,rgba(0,229,255,0.14)_1px,transparent_1px),linear-gradient(rgba(0,229,255,0.08)_1px,transparent_1px)] bg-[size:52px_100%,100%_26px]" />
    </div>
  );
}

export default function Hero3D() {
  const isMobile = useIsMobile();

  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(0,229,255,0.12),transparent_22%),radial-gradient(circle_at_82%_24%,rgba(255,255,255,0.04),transparent_20%)]" />
      <div className="relative mx-auto flex max-w-[100rem] flex-col px-4 pb-3 pt-2 lg:px-8 lg:pb-40 lg:pt-3">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/5 bg-white/[0.02] px-5 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-primary">AI StockAnalysis</p>
            <h1 className="mt-2 font-display text-2xl text-text lg:text-3xl">Market Intelligence Terminal</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-panel border border-border px-4 py-2 text-sm font-semibold text-text transition hover:border-primary/40">
              Login
            </Link>
            <Link to="/login" className="rounded-panel bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:shadow-cyan">
              Launch Workspace
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <p className="text-xs uppercase tracking-[0.38em] text-primary">Indian market signal stack</p>
            <h2 className="mt-4 max-w-4xl font-display text-4xl leading-[0.94] text-text sm:text-5xl xl:text-6xl">
              See portfolios, sentiment, metals, and context in one immersive terminal.
            </h2>
            <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-muted sm:text-base">
              Built for investors who want price structure, FinBERT sentiment, AI summaries, basket tracking, and metals intelligence without hopping across disconnected tools.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-panel bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-cyan">
                Open the terminal
                <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-panel border border-border px-5 py-3 text-sm font-semibold text-text transition hover:border-primary/40">
                Explore the workflow
              </Link>
            </div>
          </motion.div>

          <motion.div className="relative min-w-0" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-surface/80 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
              <div className="absolute inset-0">
                {isMobile ? (
                  <MobileFallback />
                ) : (
                  <Canvas camera={{ position: [0, 0, 5] }}>
                    <Suspense fallback={null}>
                      <HeroScene />
                    </Suspense>
                  </Canvas>
                )}
              </div>

              <div className="relative z-10 grid min-h-[32rem] gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:p-6 xl:min-h-[34rem]">
                <div className="pointer-events-none hidden lg:block" />

                <div className="w-full max-w-[28rem] justify-self-end self-end rounded-[1.6rem] border border-primary/15 bg-[#0d1628]/88 p-4 backdrop-blur xl:self-center">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.32em] text-primary">Signal Deck</p>
                      <h3 className="mt-2 max-w-[12ch] font-display text-2xl leading-tight text-text xl:text-[2rem]">Live Decision Layer</h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                      Realtime-ready
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
                    {[
                      { icon: Zap, title: "Momentum", value: "+4.82%", tone: "text-profit", body: "Fast winners surface first" },
                      { icon: Radar, title: "Sentiment", value: "FinBERT", tone: "text-text", body: "Company tone detection" },
                      { icon: Layers3, title: "Portfolio", value: "Multi-Basket", tone: "text-text", body: "Theme and tactical stacks" },
                      { icon: Sparkles, title: "AI Layer", value: "Grok + DeepSeek", tone: "text-primary", body: "Summary and commentary" },
                    ].map(({ icon: Icon, title, value, tone, body }) => (
                      <div key={title} className="min-w-0 rounded-panel border border-white/5 bg-white/[0.03] p-3.5">
                        <div className="flex items-center gap-2 text-primary">
                          <Icon size={16} />
                          <p className="text-xs uppercase tracking-[0.22em] text-muted">{title}</p>
                        </div>
                        <p className={`mt-2.5 break-words font-display text-[1.9rem] leading-tight ${tone}`}>{value}</p>
                        <p className="mt-2 break-words text-sm leading-5 text-muted">{body}</p>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      <div className="relative z-10 lg:absolute lg:inset-x-0 lg:bottom-0">
        <TickerStrip as="div" className="mt-4 lg:mt-0" />
      </div>
    </section>
  );
}
