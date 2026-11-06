"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { iconButton, primaryButton } from "@/components/ui/soft";
import { backdrop, spring } from "@/components/ui/motion";

export type AuthReason = "favorite" | "login";
type Mode = "login" | "signup";

/*
  Popup de autentificare / cont nou.
  DEOCAMDATĂ E DOAR DE FAȚADĂ: butoanele Apple/Google și formularul nu trimit nimic.
  Mai târziu: Supabase Auth (email + parolă, Sign in with Apple, Google OAuth).
*/
export function AuthModal({ reason, onClose }: { reason: AuthReason; onClose: () => void }) {
  const t = useTranslations("Auth");
  const [mode, setMode] = useState<Mode>("login");
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const input =
    "mt-1.5 w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink shadow-pressed outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent/60";

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
          {reason === "favorite" ? t("titleFavorite") : t("titleLogin")}
        </h2>
        <p className="mt-2 text-center text-sm text-ink-soft">
          {reason === "favorite" ? t("subFavorite") : t("subLogin")}
        </p>

        {/* Tab-uri: autentificare / cont nou, cu indicator care alunecă */}
        <div role="tablist" className="mt-6 flex rounded-full bg-cream-100 p-1 shadow-pressed">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
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

        {/* Conectare rapidă (de fațadă) */}
        <div className="mt-5 space-y-2.5">
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setNotice(true)}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-[#111] py-3.5 text-sm font-semibold text-white shadow-pill"
          >
            <AppleLogo />
            {t("apple")}
          </motion.button>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setNotice(true)}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-white py-3.5 text-sm font-semibold text-[#1f1f1f] shadow-pill ring-1 ring-sand"
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

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(true);
          }}
        >
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
                <input required autoComplete="name" className={input} />
              </motion.label>
            )}
          </AnimatePresence>
          <label className="block">
            <span className="text-xs font-semibold text-ink">{t("email")}</span>
            <input required type="email" autoComplete="email" className={input} />
          </label>
          <label className="block">
            <span className="flex items-center justify-between text-xs font-semibold text-ink">
              {t("password")}
              {mode === "login" && (
                <button type="button" onClick={() => setNotice(true)} className="font-medium text-ink-soft hover:text-ink">
                  {t("forgot")}
                </button>
              )}
            </span>
            <input
              required
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={input}
            />
          </label>
          <motion.button whileTap={{ scale: 0.98 }} type="submit" className={`${primaryButton} w-full`}>
            {mode === "login" ? t("submitLogin") : t("submitSignup")}
          </motion.button>
        </form>

        <AnimatePresence>
          {notice && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-accent-50 px-4 py-3 text-sm text-accent"
            >
              <Info className="size-4 shrink-0" />
              {t("demo")}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted">{t("terms")}</p>
      </motion.div>
    </div>
  );
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
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
