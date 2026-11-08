"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { primaryButton } from "@/components/ui/soft";
import type { AuthFormState } from "./types";

type Mode = "login" | "signup";
type Action = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const input =
  "h-12 w-full rounded-inner border border-glass-line bg-cream-100/85 px-4 text-base text-ink shadow-pressed outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-ink-soft/80 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20";

export function AuthForm({
  mode,
  action,
  passwordMin,
}: {
  mode: Mode;
  action: Action;
  passwordMin: number;
}) {
  const t = useTranslations("Dashboard");
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();

  // After a failed submit, focus the first field with a problem (or the email field).
  useEffect(() => {
    if (!state.error && !state.fields) return;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLInputElement>("[aria-invalid='true']") ??
      form?.querySelector<HTMLInputElement>("input[name='email']");
    target?.focus();
  }, [state]);

  const fieldError = (name: "full_name" | "email" | "password") => {
    const key = state.fields?.[name];
    return key ? t(`errors.${key}`, { min: passwordMin }) : null;
  };
  const nameError = fieldError("full_name");
  const emailError = fieldError("email");
  const passwordError = fieldError("password");
  const formError = state.error ? t(`errors.${state.error}`, { min: passwordMin }) : null;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4" aria-describedby={formError ? `${id}-error` : undefined}>
      <input type="hidden" name="next" value={next} />

      {mode === "signup" && (
        <Field id={`${id}-name`} label={t("auth.name")} error={nameError}>
          <input
            id={`${id}-name`}
            name="full_name"
            type="text"
            autoComplete="name"
            maxLength={80} // NAME_MAX in lib/supabase/validation.ts
            required
            placeholder={t("auth.namePlaceholder")}
            defaultValue={state.values?.full_name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
            className={input}
          />
        </Field>
      )}

      <Field id={`${id}-email`} label={t("auth.email")} error={emailError}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete={mode === "login" ? "username" : "email"}
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder={t("auth.emailPlaceholder")}
          defaultValue={state.values?.email}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `${id}-email-error` : undefined}
          className={input}
        />
      </Field>

      <Field
        id={`${id}-password`}
        label={t("auth.password")}
        error={passwordError}
        hint={mode === "signup" && !passwordError ? t("auth.passwordHint", { min: passwordMin }) : null}
      >
        <div className="relative">
          <input
            id={`${id}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? passwordMin : undefined}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={
              passwordError ? `${id}-password-error` : mode === "signup" ? `${id}-password-hint` : undefined
            }
            className={`${input} pr-13`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            title={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            className="absolute top-1 right-1 grid size-10 place-items-center rounded-full text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </Field>

      <div aria-live="polite" className="min-h-0">
        {formError && (
          <p
            id={`${id}-error`}
            role="alert"
            className="rounded-inner bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {formError}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className={`${primaryButton} min-h-12 w-full disabled:opacity-80 dark:bg-accent-strong dark:font-bold dark:shadow-[0_12px_26px_-10px_rgb(106_163_236/0.6)] dark:hover:bg-accent`}>
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {pending ? t("auth.pending") : mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup")}
      </button>

      <p className="pt-1 text-center text-sm text-ink-soft">
        {mode === "login" ? t("auth.toSignup") : t("auth.toLogin")}{" "}
        <Link
          href={{ pathname: mode === "login" ? "/cont-nou" : "/login", query: next ? { next } : undefined }}
          className="font-semibold text-accent underline decoration-accent/30 underline-offset-4 transition-colors hover:decoration-accent"
        >
          {mode === "login" ? t("auth.toSignupLink") : t("auth.toLoginLink")}
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  hint?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block pl-1 text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="pl-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="pl-1 text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
