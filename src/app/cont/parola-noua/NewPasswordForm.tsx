"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { setNewPassword, type GuestAuthResult } from "@/lib/auth/guest";
import { PASSWORD_MIN } from "@/lib/supabase/validation";
import { useAccount } from "@/lib/use-host-session";
import { card, primaryButton } from "@/components/ui/soft";

export function NewPasswordForm() {
  const t = useTranslations("Auth");
  const account = useAccount();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GuestAuthResult>({});

  const fieldError = result.fields?.password ? t(`errors.${result.fields.password}`, { min: PASSWORD_MIN }) : null;

  return (
    <div className={`${card} w-full max-w-md p-6 text-center sm:p-8`}>
      <Image src="/logo.png" alt="" width={128} height={128} className="mx-auto size-16 rounded-full shadow-soft" />
      <h1 className="mt-4 font-serif text-3xl leading-tight">{t("newPassword.title")}</h1>

      {result.ok ? (
        <>
          <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent-50 px-4 py-3 text-sm text-accent">
            <CircleCheck className="size-4 shrink-0" />
            {t("newPassword.done")}
          </p>
          <Link href="/" className={`${primaryButton} mt-6 w-full`}>
            {t("newPassword.backToSite")}
          </Link>
        </>
      ) : (
        <form
          noValidate
          className="mt-6 space-y-3 text-left"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setResult(await setNewPassword(password).catch(() => ({ error: "generic" as const })));
            setPending(false);
          }}
        >
          {!account && <p className="text-center text-sm text-ink-soft">{t("newPassword.sub")}</p>}
          <label className="block">
            <span className="text-xs font-semibold text-ink">{t("newPassword.label")}</span>
            <input
              type="password"
              autoComplete="new-password"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldError}
              className="mt-1.5 w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink shadow-pressed outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <span className={`mt-1 block text-xs ${fieldError ? "font-medium text-red-700" : "text-muted"}`}>
              {fieldError ?? t("passwordHint", { min: PASSWORD_MIN })}
            </span>
          </label>
          <button type="submit" disabled={pending} className={`${primaryButton} w-full disabled:opacity-70`}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {t("newPassword.submit")}
          </button>
          {result.error && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {t(`errors.${result.error}`)}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
