import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, AlertCircle, QrCode, Zap, ZapOff } from "lucide-react";
import jsQR from "jsqr";

interface QrScannerProps {
  onResult: (value: string) => void;
  onClose: () => void;
}

declare class BarcodeDetector {
  constructor(opts: { formats: string[] });
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

function isBarcodeDetectorSupported() {
  return typeof (window as unknown as Record<string, unknown>)["BarcodeDetector"] !== "undefined";
}

export function QrScanner({ onResult, onClose }: QrScannerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const resultFiredRef = useRef(false);

  const [error,    setError]    = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [torch,    setTorch]    = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [success,  setSuccess]  = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const fireResult = useCallback((value: string) => {
    if (resultFiredRef.current) return;
    resultFiredRef.current = true;
    setSuccess(true);
    try { navigator.vibrate?.(150); } catch { /* not supported */ }
    setTimeout(() => {
      stopCamera();
      onResult(value);
    }, 380);
  }, [onResult, stopCamera]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const newVal = !torch;
      await (track as MediaStreamTrack & { applyConstraints: (c: object) => Promise<void> })
        .applyConstraints({ advanced: [{ torch: newVal } as unknown as MediaTrackConstraintSet] });
      setTorch(newVal);
    } catch { /* torch not supported */ }
  }, [torch]);

  const startCamera = useCallback(async () => {
    setError(null);
    setScanning(false);
    setSuccess(false);
    resultFiredRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;

      // Detect torch support
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities() as Record<string, unknown>;
        if (caps && "torch" in caps) setTorchSupported(true);
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      if (isBarcodeDetectorSupported()) {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        let lastScan = 0;
        const scan = async () => {
          if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(scan); return; }
          const now = Date.now();
          if (now - lastScan >= 80) {
            lastScan = now;
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0 && codes[0]) { fireResult(codes[0].rawValue); return; }
            } catch { /* continue */ }
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } else {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        let lastScan = 0;
        const scan = () => {
          if (!video || video.readyState < 2 || video.videoWidth === 0) {
            rafRef.current = requestAnimationFrame(scan); return;
          }
          const now = Date.now();
          if (now - lastScan >= 100) {
            lastScan = now;
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "attemptBoth",
            });
            if (code?.data) { fireResult(code.data); return; }
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("NotFound")) {
        setError("Accès caméra refusé. Autorisez la caméra dans les paramètres de votre navigateur.");
      } else if (msg.includes("NotReadable") || msg.includes("Overconstrained")) {
        setError("Caméra occupée par une autre application. Fermez les autres apps.");
      } else {
        setError("Impossible d'accéder à la caméra. Utilisez HTTPS ou vérifiez les permissions.");
      }
      setScanning(false);
    }
  }, [fireResult]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.85) 0%,transparent 100%)" }}>
        <div className="flex items-center gap-2 text-white">
          <QrCode className="w-5 h-5" style={{ color: "#8DC63F" }} />
          <span className="font-black text-sm uppercase tracking-wider">Scanner votre ticket</span>
        </div>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <button
              onClick={() => void toggleTorch()}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
              style={{ background: torch ? "#fbbf24" : "rgba(255,255,255,0.12)", color: torch ? "#000" : "#fff" }}
              title="Lampe torche"
            >
              {torch ? <Zap className="w-4 h-4" fill="currentColor" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
        <canvas ref={canvasRef} className="hidden" />

        {/* Success flash */}
        {success && (
          <div className="absolute inset-0 z-20 flex items-center justify-center"
            style={{ background: "rgba(141,198,63,0.25)", animation: "successFade 0.4s ease-out forwards" }}>
            <div className="rounded-full flex items-center justify-center"
              style={{ width: 80, height: 80, background: "rgba(141,198,63,0.9)", boxShadow: "0 0 40px rgba(141,198,63,0.8)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {scanning && !error && !success && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dark vignette */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.5) 100%), linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.5) 100%)"
            }} />

            {/* Scan box */}
            <div className="relative" style={{ width: 260, height: 260 }}>
              {/* Corner brackets */}
              {[
                "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl",
                "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl",
                "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl",
                "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl",
              ].map((cls, i) => (
                <span key={i} className={`absolute w-12 h-12 ${cls}`} style={{ borderColor: "#8DC63F" }} />
              ))}

              {/* Scan line */}
              <div className="absolute inset-x-3"
                style={{ height: 2, background: "linear-gradient(90deg, transparent, #8DC63F, transparent)", boxShadow: "0 0 12px rgba(141,198,63,0.8)", animation: "scanline 1.8s ease-in-out infinite" }}
              />

              {/* Center hint */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg px-3 py-1.5"
                  style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(141,198,63,0.3)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(141,198,63,0.9)" }}>QR Code du ticket</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {!scanning && !error && !success && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#8DC63F" }} />
            <p className="text-white/50 text-xs">Démarrage de la caméra…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-black">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white text-sm leading-relaxed">{error}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button onClick={() => void startCamera()}
                className="px-6 py-3 rounded-xl text-black font-black text-sm uppercase tracking-wide"
                style={{ background: "linear-gradient(135deg,#8DC63F,#6ba832)" }}>
                Réessayer
              </button>
              <button onClick={() => { stopCamera(); onClose(); }}
                className="px-6 py-3 rounded-xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                Saisir le code manuellement
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {scanning && !error && !success && (
        <div className="px-6 py-5 text-center shrink-0"
          style={{ background: "linear-gradient(0deg,rgba(0,0,0,0.9) 0%,transparent 100%)" }}>
          <p className="text-white/50 text-xs leading-relaxed">Pointez la caméra vers le <strong className="text-white/70">QR code</strong> imprimé sur votre ticket</p>
          <button onClick={() => { stopCamera(); onClose(); }}
            className="mt-2 text-xs underline underline-offset-2"
            style={{ color: "rgba(141,198,63,0.6)" }}>
            Saisir le code manuellement
          </button>
        </div>
      )}

      <style>{`
        @keyframes scanline {
          0%   { top: 4px;   opacity: 1; }
          48%  { opacity: 1; }
          50%  { top: calc(100% - 6px); opacity: 0.4; }
          52%  { opacity: 1; }
          100% { top: 4px;   opacity: 1; }
        }
        @keyframes successFade {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
