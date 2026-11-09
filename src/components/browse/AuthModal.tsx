"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CircleAlert,
  Eye,
  EyeOff,
  House,
  HousePlus,
  Loader2,
  LogOut,
  MailCheck,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { hostDashboardUrl, hostSignupUrl } from "@/lib/links";
import { useAccount } from "@/lib/use-host-session";
import {
  guestGoogle,
  guestLogin,
  guestSignOut,
  guestSignup,
  requestPasswordReset,
  type GuestAuthResult,
} from "@/lib/auth/guest";
import { PASSWORD_MIN } from "@/lib/supabase/validation";
import { openCookieSettings } from "@/lib/consent";
import { iconButton, primaryButton } from "@/components/ui/soft";
import { backdrop, spring } from "@/components/ui/motion";

export type AuthReason = "favorite" | "login" | "linkError";
type Mode = "login" | "signup" | "forgot";
type Result = GuestAuthResult | { error: "linkExpired" };

/*
  Popup de autentificare / cont nou pentru CLIENȚI (Supabase Auth, din browser: src/lib/auth/guest.ts).
  - Email + parolă: cont nou, intrare, „Ai uitat parola?" (link pe email -> /cont/parola-noua).
  - Google: redirecționare la Google și înapoi pe /auth/callback.
  - Apple: „În curând".
  - Logat: arată contul și „Ieși din cont".
  Conturile de client nu primesc panou de gazdă (vezi supabase/migrations/0012_guest_accounts.sql).
*/
export function AuthModal({ reason, onClose }: { reason: AuthReason; onClose: () => void }) {
  const t = useTranslations("Auth");
  const tHeader = useTranslations("Header");
  const account = useAccount();
  const hostSignedIn = account?.kind === "host";
  const [mode, setMode] = useState<Mode>("login");
  const [values, setValues] = useState({ full_name: "", email: "", password: "" });
  const [result, setResult] = useState<Result>(reason === "linkError" ? { error: "linkExpired" } : {});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setResult({});
  };

  const run = async (task: () => Promise<GuestAuthResult>, closeOnOk = true) => {
    setPending(true);
    setResult({});
    try {
      const r = await task();
      setResult(r);
      if (r.ok && closeOnOk) onClose();
    } catch {
      setResult({ error: "generic" });
    } finally {
      setPending(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") run(() => guestSignup(values));
    else if (mode === "login") run(() => guestLogin(values));
    else run(() => requestPasswordReset(values.email), false);
  };

  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const fields = "fields" in result ? result.fields : undefined;
  const fieldError = (field: "full_name" | "email" | "password") => {
    const key = fields?.[field];
    return key ? t(`errors.${key}`, { min: PASSWORD_MIN }) : null;
  };
  const error = "error" in result ? result.error : undefined;
  const notice = "notice" in result ? result.notice : undefined;

  const input =
    "mt-1.5 w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink shadow-pressed outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent/60 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-600/50";

  const title = account
    ? t("account.title")
    : mode === "forgot"
      ? t("forgotTitle")
      : reason === "favorite"
        ? t("titleFavorite")
        : t("titleLogin");
  const subtitle = account
    ? t("account.sub")
    : mode === "forgot"
      ? t("forgotSub")
      : reason === "favorite"
        ? t("subFavorite")
        : t("subLogin");

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <motion.button
        type="button"
        variants={backdrop}
        initial="hidden"
        animate="show"
        exit="exit"
        className="absolute inset-0 bg-[#0b1220]/45 backdrop-blur-md"
        onClick={onClose}
        aria-label={t("close")}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: spring }}
        exit={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(4px)", transition: { duration: 0.18 } }}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-card bg-cream-50 p-6 shadow-soft sm:p-8"
      >
        <button type="button" onClick={onClose} className={`${iconButton} absolute top-4 right-4`} aria-label={t("close")}>
          <X className="size-4" />
        </button>

        <motion.div
          initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.08 }}
          className="mx-auto w-fit"
        >
          <Image src="/logo.png" alt="" width={128} height={128} className="size-16 rounded-full shadow-soft" />
        </motion.div>

        <h2 id="auth-title" className="mt-4 text-center font-serif text-3xl leading-tight">
          {title}
        </h2>
        <p className="mt-2 text-center text-sm text-ink-soft">{subtitle}</p>

        {account ? (
          /* ---------- Logat: contul și ieșirea ---------- */
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-cream-100 px-4 py-3 shadow-pressed">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-cream-50">
                {(account.name ?? account.email ?? "?").trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{account.name ?? account.email}</span>
                <span className="block truncate text-xs text-muted">
                  {account.kind === "host" ? t("account.host") : t("account.guest")}
                  {account.email && account.name ? ` · ${account.email}` : ""}
                </span>
              </span>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await guestSignOut().catch(() => {});
                setPending(false);
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-cream-100 py-3.5 text-sm font-semibold text-ink shadow-pill ring-1 ring-sand transition-colors hover:bg-cream-200 disabled:opacity-60"
            >
              <LogOut className="size-4" />
              {t("account.signOut")}
            </button>
          </div>
        ) : (
          <>
            {mode !== "forgot" && (
              <>
                {/* Tab-uri: autentificare / cont nou, cu indicator care alunecă */}
                <div role="tablist" className="mt-6 flex rounded-full bg-cream-100 p-1 shadow-pressed">
                  {(["login", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => switchMode(m)}
                      className={`relative flex-1 rounded-full py-2.5 text-sm transition-colors ${
                        mode === m ? "font-semibold text-ink" : "font-medium text-ink-soft hover:text-ink"
                      }`}
                    >
                      {mode === m && (
                        <motion.span layoutId="auth-tab" transition={spring} className="absolute inset-0 rounded-full bg-cream-50 shadow-pill" />
                      )}
                      <span className="relative">{t(`tabs.${m}`)}</span>
                    </button>
                  ))}
                </div>

                {/* Conectare rapidă: Apple „în curând", Google activ */}
                <div className="mt-5 space-y-2.5">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-full bg-[#111]/55 py-3.5 text-sm font-semibold text-white/80 shadow-pill"
                  >
                    <AppleLogo />
                    {t("apple")}
                    <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-ink">{t("soon")}</span>
                  </button>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={pending}
                    onClick={() => run(guestGoogle, false)}
                    className="flex w-full items-center justify-center gap-3 rounded-full bg-white py-3.5 text-sm font-semibold text-[#1f1f1f] shadow-pill ring-1 ring-sand disabled:opacity-60"
                  >
                    <GoogleLogo />
                    {t("google")}
                  </motion.button>
                </div>

                <div className="my-5 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-sand-200" />
                  {t("or")}
                  <span className="h-px flex-1 bg-sand-200" />
                </div>
              </>
            )}

            <form className={`space-y-3 ${mode === "forgot" ? "mt-6" : ""}`} onSubmit={submit} noValidate>
              <AnimatePresence initial={false}>
                {mode === "signup" && (
                  <motion.label
                    key="name"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring}
                    className="block overflow-hidden"
                  >
                    <span className="text-xs font-semibold text-ink">{t("name")}</span>
                    <input
                      autoComplete="name"
                      maxLength={80}
                      value={values.full_name}
                      onChange={set("full_name")}
                      aria-invalid={!!fieldError("full_name")}
                      className={input}
                    />
                    <FieldError text={fieldError("full_name")} />
                  </motion.label>
                )}
              </AnimatePresence>
              <label className="block">
                <span className="text-xs font-semibold text-ink">{t("email")}</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={set("email")}
                  aria-invalid={!!fieldError("email")}
                  className={input}
                />
                <FieldError text={fieldError("email")} />
              </label>
              {mode !== "forgot" && (
                <div className="block">
                  {/* No wrapping <label> here: it would label the first control inside it (the forgot button), not the input. */}
                  <span className="flex items-center justify-between text-xs font-semibold text-ink">
                    <label htmlFor={passwordId}>{t("password")}</label>
                    {mode === "login" && (
                      <button type="button" onClick={() => switchMode("forgot")} className="font-medium text-ink-soft hover:text-ink">
                        {t("forgot")}
                      </button>
                    )}
                  </span>
                  <span className="relative block">
                    <input
                      id={passwordId}
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      maxLength={72}
                      value={values.password}
                      onChange={set("password")}
                      aria-invalid={!!fieldError("password")}
                      className={`${input} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      className="absolute top-1/2 right-3 mt-[3px] -translate-y-1/2 p-1 text-ink-soft hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                  {mode === "signup" && !fieldError("password") && (
                    <span className="mt-1 block text-xs text-muted">{t("passwordHint", { min: PASSWORD_MIN })}</span>
                  )}
                  <FieldError text={fieldError("password")} />
                </div>
              )}
              <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={pending} className={`${primaryButton} w-full disabled:opacity-70`}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {mode === "login" ? t("submitLogin") : mode === "signup" ? t("submitSignup") : t("forgotSubmit")}
              </motion.button>
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="mx-auto flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
                >
                  <ArrowLeft className="size-4" />
                  {t("backToLogin")}
                </button>
              )}
            </form>

            <AnimatePresence>
              {(error || notice) && (
                <motion.p
                  key={error ?? notice}
                  role={error ? "alert" : "status"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
                    error ? "bg-red-50 text-red-800" : "bg-accent-50 text-accent"
                  }`}
                >
                  {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <MailCheck className="mt-0.5 size-4 shrink-0" />}
                  {error ? t(`errors.${error}`) : t(`notices.${notice}`)}
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Pentru proprietari (pe telefon e singurul loc, fiindcă antetul nu are spațiu pentru buton) */}
        {account?.kind !== "guest" && (
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink-soft shadow-pressed">
            {!hostSignedIn && t("hostQuestion")}
            <a
              href={hostSignedIn ? hostDashboardUrl : hostSignupUrl}
              className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
            >
              {hostSignedIn ? <House className="size-4" /> : <HousePlus className="size-4" />}
              {tHeader(hostSignedIn ? "hostAccount" : "hostSignup")}
            </a>
          </p>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">
          {t("terms")}{" "}
          <button type="button" onClick={openCookieSettings} className="font-semibold underline-offset-2 hover:text-ink hover:underline">
            {t("cookieSettings")}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function FieldError({ text }: { text: string | null }) {
  if (!text) return null;
  return <span className="mt-1 block text-xs font-medium text-red-700">{text}</span>;
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.260-3.428-2.8-1.287-1.82-2.323-4.630-2.323-7.280 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
