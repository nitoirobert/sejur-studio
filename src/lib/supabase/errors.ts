import type { AuthError } from "@supabase/supabase-js";

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailTaken"
  | "passwordShort"
  | "emailInvalid"
  | "rateLimit"
  | "generic";

// Maps a Supabase Auth error to a Dashboard.errors key. Raw messages never reach the UI.
export function authErrorKey(error: AuthError, mode: "login" | "signup"): AuthErrorKey {
  const code = error.code ?? "";
  if (error.status === 429 || code.startsWith("over_") || code.includes("rate_limit")) return "rateLimit";
  if (mode === "login") return error.status && error.status >= 500 ? "generic" : "invalidCredentials";
  if (code === "user_already_exists" || code === "email_exists") return "emailTaken";
  if (code === "weak_password") return "passwordShort";
  if (code === "email_address_invalid" || code === "validation_failed") return "emailInvalid";
  return "generic";
}
