import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, SwitchCamera } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BarcodeCameraScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
];

const PRODUCTION_POS_URL = "https://vsmcollection.com/pos";

function getInsecureContextMessage(): string | null {
  if (typeof window === "undefined" || window.isSecureContext) return null;
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  if (isLocalhost) return null;
  return `La caméra est bloquée en HTTP (${host}). Les navigateurs exigent HTTPS (cadenas) sauf sur localhost. Ouvrez le POS en production : ${PRODUCTION_POS_URL}`;
}

export function BarcodeCameraScanner({ open, onOpenChange, onScan }: BarcodeCameraScannerProps) {
  const reactId = useId();
  const containerId = `pos-barcode-scanner-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef("");
  const lastScanAtRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const useFrontCameraRef = useRef(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore cleanup errors
    }
  }, []);

  const startScanner = useCallback(async () => {
    await stopScanner();
    setError(null);

    const insecureMsg = getInsecureContextMessage();
    if (insecureMsg) {
      setError(insecureMsg);
      return;
    }

    setStarting(true);

    try {
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: useFrontCameraRef.current ? "user" : "environment" },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(viewfinderWidth * 0.92, 420);
            const height = Math.min(Math.max(viewfinderHeight * 0.28, 90), 160);
            return { width, height };
          },
          aspectRatio: 1.777778,
        },
        (decodedText) => {
          const code = decodedText.trim();
          if (!code) return;
          const now = Date.now();
          if (code === lastScanRef.current && now - lastScanAtRef.current < 2500) return;
          lastScanRef.current = code;
          lastScanAtRef.current = now;
          onScan(code);
        },
        () => {
          // no match in this frame — expected while aiming
        }
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible d'accéder à la caméra";
      setError(msg);
    } finally {
      setStarting(false);
    }
  }, [containerId, onScan, stopScanner]);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void startScanner();
    }, 300);

    return () => {
      window.clearTimeout(timer);
      void stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  const toggleCamera = async () => {
    useFrontCameraRef.current = !useFrontCameraRef.current;
    setUseFrontCamera(useFrontCameraRef.current);
    if (open) {
      await stopScanner();
      setTimeout(() => void startScanner(), 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Scanner avec la caméra
          </DialogTitle>
          <DialogDescription>
            Pointez le code-barres dans le cadre. L'article sera ajouté automatiquement au panier.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
          <div id={containerId} className="min-h-[240px] w-full [&_video]:!rounded-lg" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
              Ouverture de la caméra…
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <CameraOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Caméra indisponible</p>
              <p className="mt-1 text-xs opacity-90">{error}</p>
              {!window.isSecureContext && (
                <a
                  href={PRODUCTION_POS_URL}
                  className="mt-2 inline-block text-xs font-medium text-primary underline"
                >
                  Ouvrir le POS en HTTPS (production)
                </a>
              )}
              {window.isSecureContext && (
                <p className="mt-2 text-xs opacity-90">
                  Autorisez l'accès à la caméra dans les paramètres du navigateur, puis réessayez.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void startScanner()}>
            <Camera className="h-4 w-4" />
            Relancer
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void toggleCamera()}>
            <SwitchCamera className="h-4 w-4" />
            {useFrontCamera ? "Caméra arrière" : "Caméra avant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
