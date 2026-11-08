"use client";

import { createClient } from "@/lib/supabase/client";
import { authErrorKey } from "@/lib/supabase/errors";
import { loginSchema, signupSchema } from "@/lib/supabase/validation";

/*
  Conturile de CLIENT (popup-ul de pe site). Gazdele au formularele lor în /login și /cont-nou.
  Rulează în browser, nu pe server: Supabase limitează înscrierile per IP, iar prin server toți
  clienții ar avea același IP. Sesiunea ajunge direct în cookie, iar useAccount() o vede imediat.
  account_type: "guest" -> trigger-ul din 0012_guest_accounts nu creează organizație.
  Toate mesajele sunt chei sub Auth.errors / Auth.notices (traduse în toate limbile).
*/

export type GuestFieldError = "nameEmpty" | "nameLong" | "emailInvalid" | "passwordShort" | "passwordLong";
export type GuestAuthResult = {
  ok?: boolean; // sesiunea e activă: popup-ul se poate închide
  notice?: "confirmEmail" | "resetSent";
  error?: "invalidCredentials" | "emailTaken" | "rateLimit" | "generic";
  fields?: Partial<Record<"full_name" | "email" | "password", GuestFieldError>>;
};

const callback = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fields: GuestAuthResult["fields"] = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof NonNullable<GuestAuthResult["fields"]>;
    fields[field] ??= issue.message as GuestFieldError;
  }
  return fields;
}

export async function guestSignup(input: { full_name: string; email: string; password: string }): Promise<GuestAuthResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const { email, password, full_name } = parsed.data;

  const { data, error } = await createClient().auth.signUp({
    email,
    password,
    options: { data: { full_name, account_type: "guest" }, emailRedirectTo: callback("/") },
  });
  if (error) {
    const key = authErrorKey(error, "signup");
    if (key === "passwordShort") return { fields: { password: key } };
    if (key === "emailInvalid") return { fields: { email: key } };
    return { error: key };
  }
  // Cu confirmarea pe email pornită (producție), sesiunea vine abia după click pe link.
  if (!data.session) return { notice: "confirmEmail" };
  return { ok: true };
}

export async function guestLogin(input: { email: string; password: string }): Promise<GuestAuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidCredentials" };
  const { error } = await createClient().auth.signInWithPassword(parsed.data);
  if (error) {
    const key = authErrorKey(error, "login");
    return { error: key === "rateLimit" || key === "generic" ? key : "invalidCredentials" };
  }
  return { ok: true };
}

// Google: redirecționează la Google, apoi înapoi pe /auth/callback (vezi route.ts).
// Cere providerul Google pornit în Supabase (Authentication -> Providers).
export async function guestGoogle(): Promise<GuestAuthResult> {
  const next = window.location.pathname + window.location.search;
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback(next || "/") },
  });
  return error ? { error: "generic" } : { ok: true };
}

// „Ai uitat parola?": același răspuns și dacă emailul nu există (nu dezvăluim conturile).
export async function requestPasswordReset(emailRaw: string): Promise<GuestAuthResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fields: { email: "emailInvalid" } };
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: callback("/cont/parola-noua") });
  if (error && authErrorKey(error, "login") === "rateLimit") return { error: "rateLimit" };
  return { notice: "resetSent" };
}

export async function setNewPassword(password: string): Promise<GuestAuthResult> {
  const parsed = signupSchema.shape.password.safeParse(password);
  if (!parsed.success) return { fields: { password: parsed.error.issues[0].message as GuestFieldError } };
  const { error } = await createClient().auth.updateUser({ password: parsed.data });
  if (error) {
    const key = authErrorKey(error, "signup");
    return key === "passwordShort" ? { fields: { password: key } } : { error: key === "rateLimit" ? key : "generic" };
  }
  return { ok: true };
}

export async function guestSignOut() {
  await createClient().auth.signOut();
}
