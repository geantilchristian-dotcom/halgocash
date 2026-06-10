export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface CompressResult {
  dataUrl: string;
  mimeType: string;
  originalKb: number;
  compressedKb: number;
}

export function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = options;
  const originalKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas non disponible")); return; }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/webp", quality);
      const base64Data = dataUrl.split(",")[1] ?? "";
      const compressedKb = Math.round((base64Data.length * 3) / 4 / 1024);

      resolve({ dataUrl, mimeType: "image/webp", originalKb, compressedKb });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire l'image"));
    };

    img.src = objectUrl;
  });
}
