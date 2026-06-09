import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, AlertCircle, QrCode, Flashlight } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const resultFiredRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [torch, setTorch] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const fireResult = useCallback((value: string) => {
    if (resultFiredRef.current) return;
    resultFiredRef.current = true;
    stopCamera();
    onResult(value);
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
    resultFiredRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      if (isBarcodeDetectorSupported()) {
        // ── Fast path: native BarcodeDetector (Chrome/Android) ──
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!video || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(scan);
            return;
          }
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && codes[0]) { fireResult(codes[0].rawValue); return; }
          } catch { /* continue */ }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } else {
        // ── Fallback: jsQR via canvas (Safari/iOS/Firefox) ──
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const scan = () => {
          if (!video || video.readyState < 2 || video.videoWidth === 0) {
            rafRef.current = requestAnimationFrame(scan);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) { fireResult(code.data); return; }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("NotFound")) {
        setError("Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur, puis réessayez.");
      } else if (msg.includes("NotReadable") || msg.includes("Overconstrained")) {
        setError("Caméra occupée par une autre application. Fermez les autres apps et réessayez.");
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
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <QrCode className="w-5 h-5 text-[#3aab3a]" />
          <span className="font-bold text-sm uppercase tracking-wider">Scanner votre ticket</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTorch}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${torch ? "bg-yellow-400 text-black" : "bg-white/10 text-white"}`}
            title="Lampe torche"
          >
            <Flashlight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        {scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dimmed corners */}
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 68% 68% at 50% 50%, transparent 0%, rgba(0,0,0,0.55) 100%)" }} />
            {/* Scan box */}
            <div className="relative w-64 h-64">
              <span className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-[#3aab3a] rounded-tl-lg" />
              <span className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-[#3aab3a] rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-[#3aab3a] rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-[#3aab3a] rounded-br-lg" />
              {/* Animated scan line */}
              <div
                className="absolute inset-x-2 h-0.5 bg-[#3aab3a]"
                style={{ animation: "scanline 2s ease-in-out infinite", boxShadow: "0 0 8px #3aab3a" }}
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="w-10 h-10 text-[#3aab3a] animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-black">
            <AlertCircle className="w-12 h-12 text-red-400 shrink-0" />
            <p className="text-white text-sm leading-relaxed">{error}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={() => void startCamera()}
                className="px-6 py-2.5 rounded-xl text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg, #3aab3a, #2d8a2d)" }}
              >
                Réessayer
              </button>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="px-6 py-2.5 rounded-xl text-white/60 font-bold text-sm bg-white/10"
              >
                Saisir le code manuellement
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {scanning && !error && (
        <div className="px-4 py-4 text-center shrink-0">
          <p className="text-white/60 text-xs">Placez le QR code dans le cadre vert</p>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="mt-2 text-xs text-white/40 underline underline-offset-2"
          >
            Saisir le code manuellement
          </button>
        </div>
      )}

      <style>{`
        @keyframes scanline {
          0%   { top: 0; opacity: 1; }
          49%  { opacity: 1; }
          50%  { top: calc(100% - 2px); opacity: 0.6; }
          100% { top: 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
