import { z } from "zod";

// Equal to `minimum_password_length` in supabase/config.toml and on the cloud dev project.
export const PASSWORD_MIN = 8;
// bcrypt ignores bytes past 72; Supabase rejects longer passwords.
export const PASSWORD_MAX = 72;
export const NAME_MAX = 80;

// Messages are keys under Dashboard.errors.
export const signupSchema = z.object({
  full_name: z.string().trim().min(1, "nameEmpty").max(NAME_MAX, "nameLong"),
  email: z.string().trim().toLowerCase().pipe(z.email("emailInvalid")),
  password: z.string().min(PASSWORD_MIN, "passwordShort").max(PASSWORD_MAX, "passwordLong"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(PASSWORD_MAX),
});

const FALLBACK = "/dashboard";
const BASE = "http://internal.invalid";

// Only same-origin paths: "/x" yes; "//host", "/\host", "https://host", control chars no.
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return FALLBACK;
  if (!raw.startsWith("/") || raw.startsWith("//")) return FALLBACK;
  // A backslash or control character can turn a path into a host in some browsers.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return FALLBACK;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return FALLBACK;
    // Dot segments can collapse "/.//evil.com" into "//evil.com"; re-check after normalising.
    const out = url.pathname + url.search + url.hash;
    if (out.startsWith("//") || out.startsWith("/\\")) return FALLBACK;
    return out;
  } catch {
    return FALLBACK;
  }
}
