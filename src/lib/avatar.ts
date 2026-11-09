// Profile picture of a user, from Supabase user_metadata. Used on the server and in the browser.
// The picture the user uploaded (custom_avatar_url) wins over the one Google sends.

export const AVATAR_BUCKET = "avatars";
export const AVATAR_SIZE = 256; // px, square; the browser resizes before upload

export function avatarOf(meta: Record<string, unknown>): string | null {
  const url = meta.custom_avatar_url || meta.avatar_url || meta.picture;
  return typeof url === "string" && url ? url : null;
}

// Center-crops and resizes an image file to a square WebP blob (keeps uploads small, strips EXIF).
export async function squareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/webp", 0.85),
  );
}
