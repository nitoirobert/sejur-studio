// Browser only. Decodes an already checked image, scales it so the longer side is at most `max` px
// and re-encodes it as WebP. Drawing on a canvas keeps only pixels: EXIF, GPS and every other
// metadata block are gone from the output. The orientation is applied by the decoder first.

export const MAX_SIDE = 2000;
export const WEBP_QUALITY = 0.86;

export type Resized = { blob: Blob; width: number; height: number };

/** Target size for a max side, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function resizeToWebp(file: Blob, max = MAX_SIDE): Promise<Resized> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    // A browser without a WebP encoder falls back to PNG: refuse instead of storing a mislabeled file.
    if (!blob || blob.type !== "image/webp") throw new Error("webp encoding unavailable");
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
