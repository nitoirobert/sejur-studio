// URL slug of a property: lowercase ASCII words joined by "-", same rule as the DB check
// (^[a-z0-9]+(-[a-z0-9]+)*$). Romanian letters are transliterated: „Casa Ștefăniță” -> casa-stefanita.

export const SLUG_MIN = 3;
export const SLUG_MAX = 80;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Letters NFD does not split into base + mark.
const EXTRA: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ł: "l", ı: "i" };

export function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[ßæœøđłı]/g, (c) => EXTRA[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}/gu, ""); // ș = s + U+0326, ă = a + U+0306, ...
  const slug = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return slug.length >= SLUG_MIN ? slug : slug ? `${slug}-${"x".repeat(SLUG_MIN - slug.length)}` : "proprietate";
}

/** The next candidate after a taken slug: casa -> casa-2 -> casa-3; casa-2 -> casa-3. */
export function nextSlug(slug: string): string {
  const m = /^(.*)-(\d{1,4})$/.exec(slug);
  const base = m && Number(m[2]) >= 2 ? m[1] : slug;
  const n = m && Number(m[2]) >= 2 ? Number(m[2]) + 1 : 2;
  const suffix = `-${n}`;
  return `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
