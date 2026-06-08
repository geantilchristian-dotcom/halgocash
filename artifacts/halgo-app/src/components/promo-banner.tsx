import { useState, useEffect, useRef } from "react";

export interface PromoBannerConfig {
  bgColor1: string;
  bgColor2: string;
  bgColor3: string;
  line1Text: string;
  line1Color: string;
  line1Font: string;
  line2Text: string;
  line2Color: string;
  line2Font: string;
  line2Suffix: string;
  line2SuffixColor: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
  animation: "slide" | "glow" | "pulse" | "shimmer";
}

const DEFAULT: PromoBannerConfig = {
  bgColor1: "#1a5c2a",
  bgColor2: "#22c55e",
  bgColor3: "#F5C518",
  line1Text: "GAGNEZ JUSQU'À",
  line1Color: "rgba(255,255,255,0.85)",
  line1Font: "Plus Jakarta Sans",
  line2Text: "1.000.000",
  line2Color: "#ffffff",
  line2Font: "Oswald",
  line2Suffix: "CDF",
  line2SuffixColor: "#F5C518",
  badgeText: "CHAQUE SAMEDI",
  badgeColor: "#ffffff",
  badgeBg: "rgba(0,0,0,0.30)",
  animation: "slide",
};

const LOOP_INTERVAL = 5000;


export function PromoBanner() {
  const [cfg, setCfg] = useState<PromoBannerConfig>(DEFAULT);
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/promo-banner")
      .then((r) => r.json())
      .then((d) => setCfg(d as PromoBannerConfig))
      .catch(() => {});
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setAnimKey((k) => k + 1), LOOP_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const anim = cfg.animation;

  const line1Style: React.CSSProperties = {
    color: cfg.line1Color,
    fontFamily: `'${cfg.line1Font}', sans-serif`,
    animation: anim === "glow"
      ? "promo-glow-line 1.8s ease-in-out infinite"
      : "promo-slide-left 0.55s cubic-bezier(0.23,1,0.32,1) 0.1s both",
  };

  const line2Style: React.CSSProperties = {
    fontFamily: `'${cfg.line2Font}', sans-serif`,
    animation: anim === "shimmer"
      ? "promo-shimmer-bg 2.5s linear infinite"
      : anim === "glow"
      ? "promo-zoom-in 0.6s cubic-bezier(0.23,1,0.32,1) 0.4s both, promo-glow-line 1.8s ease-in-out 1.5s infinite"
      : anim === "pulse"
      ? "promo-zoom-in 0.6s cubic-bezier(0.23,1,0.32,1) 0.4s both, promo-pulse-amount 1.8s ease-in-out 1.5s infinite"
      : "promo-zoom-in 0.6s cubic-bezier(0.23,1,0.32,1) 0.4s both, promo-pulse-amount 2.5s ease-in-out 1.5s infinite",
    ...(anim === "shimmer" ? {
      background: `linear-gradient(90deg, ${cfg.line2Color} 20%, rgba(255,255,255,0.95) 50%, ${cfg.line2Color} 80%)`,
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    } : { color: cfg.line2Color }),
  };

  const badgeStyle: React.CSSProperties = {
    background: cfg.badgeBg,
    color: cfg.badgeColor,
    animation: "promo-bounce-in 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.75s both, promo-badge-pulse 2.2s ease-in-out 2s infinite",
  };

  return (
    <div
      className="rounded-3xl overflow-hidden relative shadow-md"
      style={{
        background: `linear-gradient(135deg, ${cfg.bgColor1} 0%, ${cfg.bgColor2} 55%, ${cfg.bgColor3} 100%)`,
        minHeight: 90,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 80% 50%, ${cfg.bgColor3}80 0%, transparent 60%)` }}
      />
      <div className="relative z-10 px-5 py-4">
        <p
          key={`l1-${animKey}`}
          className="text-[11px] font-bold uppercase tracking-widest mb-0.5 leading-none"
          style={line1Style}
        >
          {cfg.line1Text}
        </p>
        <p
          key={`l2-${animKey}`}
          className="font-black text-2xl leading-none mb-2"
          style={{ ...line2Style, textShadow: anim !== "shimmer" ? "0 2px 10px rgba(0,0,0,0.25)" : "none" }}
        >
          {cfg.line2Text}{" "}
          <span
            style={{
              color: anim === "shimmer" ? undefined : cfg.line2SuffixColor,
              WebkitTextFillColor: anim === "shimmer" ? cfg.line2SuffixColor : undefined,
            }}
          >
            {cfg.line2Suffix}
          </span>
        </p>
        <div
          key={`badge-${animKey}`}
          className="inline-flex items-center px-2.5 py-1 rounded-full"
          style={badgeStyle}
        >
          <span className="font-black text-[10px] uppercase tracking-widest">{cfg.badgeText}</span>
        </div>
      </div>
    </div>
  );
}
