// Checks a chosen file BEFORE any decoding or resizing: size first, then the declared type, then the
// first bytes (a PDF renamed to .jpg is still refused). Same limits as the `photos` bucket
// (10 MB, jpeg / png / webp / avif, no SVG), so the browser never sends what Storage would refuse.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export type FileProblem = "too_big" | "bad_type" | "empty";

type Sniffed = (typeof ACCEPTED_TYPES)[number] | null;

/** The image type from the magic bytes, or null. */
export function sniff(head: Uint8Array): Sniffed {
  const b = (i: number) => head[i] ?? -1;
  const ascii = (from: number, s: string) => [...s].every((c, i) => b(from + i) === c.charCodeAt(0));
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && ascii(1, "PNG") && b(4) === 0x0d && b(5) === 0x0a) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}

export async function checkImageFile(file: Pick<Blob, "size" | "type" | "slice">): Promise<FileProblem | null> {
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "too_big";
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "bad_type";
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniff(head) ? null : "bad_type";
}
