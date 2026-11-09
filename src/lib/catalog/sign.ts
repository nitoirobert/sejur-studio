import { cacheLife } from "next/cache";
import { anonClient } from "./anon";

// Signed photo URLs, cached so the same path keeps the SAME url for days.
// Why: `next/image` caches the optimized file by the source url. A fresh token on every render
// (as createSignedUrls would give) means a new url, so a cache miss every time and the optimizer
// re-downloads and re-encodes the photo for every visitor.
// A url is signed for 7 days, reused for 3, so a visitor never gets one that is about to expire.

const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

async function signOne(path: string): Promise<string | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3 * 24 * 60 * 60, expire: 5 * 24 * 60 * 60 });
  const { data, error } = await anonClient().storage.from("photos").createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// path -> signed url (paths that cannot be signed are left out).
export async function signPhotoPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  const urls = await Promise.all(unique.map((p) => signOne(p)));
  const out = new Map<string, string>();
  unique.forEach((p, i) => {
    const u = urls[i];
    if (u) out.set(p, u);
  });
  return out;
}
