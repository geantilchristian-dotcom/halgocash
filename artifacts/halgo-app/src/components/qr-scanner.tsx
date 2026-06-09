import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, AlertCircle, QrCode } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (isBarcodeDetectorSupported()) {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            rafRef.current = requestAnimationFrame(scan);
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0]) {
              stopCamera();
              onResult(codes[0].rawValue);
              return;
            }
          } catch { /* continue */ }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } else {
        setError("Scanner QR non disponible sur cet appareil. Saisissez le code manuellement.");
        stopCamera();
        setScanning(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur.");
      } else {
        setError("Impossible d'accéder à la caméra.");
      }
      setScanning(false);
    }
  }, [onResult, stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <QrCode className="w-5 h-5 text-[#3aab3a]" />
          <span className="font-bold text-sm uppercase tracking-wider">Scanner votre ticket</span>
        </div>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              <span className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-[#3aab3a] rounded-tl-lg" />
              <span className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-[#3aab3a] rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-[#3aab3a] rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-[#3aab3a] rounded-br-lg" />
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#3aab3a]/70 animate-pulse" />
            </div>
          </div>
        )}

        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="w-10 h-10 text-[#3aab3a] animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-white text-sm leading-relaxed">{error}</p>
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="mt-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #3aab3a, #2d8a2d)" }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>

      {scanning && !error && (
        <div className="px-4 py-4 text-center shrink-0">
          <p className="text-white/60 text-xs">Pointez la caméra vers le QR code de votre ticket</p>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="mt-3 text-xs text-white/50 underline underline-offset-2"
          >
            Saisir le code manuellement
          </button>
        </div>
      )}
    </div>
  );
}
