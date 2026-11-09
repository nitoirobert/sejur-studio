"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";

// Small shared pieces of the account forms.

export const inputClass =
  "mt-1.5 w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink shadow-pressed outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent/60 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-600/50 disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-cream-100 px-5 py-3 text-sm font-semibold text-ink shadow-pill ring-1 ring-sand transition-colors hover:bg-cream-200 disabled:opacity-60";

export const saveButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-cream-50 shadow-accent transition-colors hover:bg-accent-600 disabled:opacity-60";

export const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-red-700 px-5 py-3 text-sm font-semibold text-white shadow-pill transition-colors hover:bg-red-800 disabled:opacity-50";

// Compact variants for the settings rows (button sits next to its text).
export const secondaryButtonSm = secondaryButton.replace("px-5 py-3", "px-4 py-2");
export const saveButtonSm = saveButton.replace("px-5 py-3", "px-4 py-2");
export const dangerButtonSm = dangerButton.replace("px-5 py-3", "px-4 py-2");

// One line of a settings list: title + short text on the left, the action on the right.
export function SettingRow({
  title,
  text,
  danger,
  action,
}: {
  title: string;
  text?: string;
  danger?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${danger ? "text-red-800" : "text-ink"}`}>{title}</p>
        {text && <p className="mt-0.5 max-w-prose text-xs text-ink-soft">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Spinner({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <Loader2 className="size-4 animate-spin" /> : <>{children}</>;
}

// One status line under a form: an error (alert) or a success notice (status).
export function FormMessage({ kind, text }: { kind: "error" | "ok" | null; text: string | null }) {
  return (
    <AnimatePresence>
      {kind && text && (
        <motion.p
          key={text}
          role={kind === "error" ? "alert" : "status"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${
            kind === "error" ? "bg-red-50 text-red-800" : "bg-accent-50 text-accent"
          }`}
        >
          {kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0" />}
          {text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full shadow-pressed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
        checked ? "bg-accent" : "bg-sand-200 ring-1 ring-sand"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-1 size-5 rounded-full bg-cream-50 shadow-pill ${checked ? "right-1" : "left-1"}`}
      />
    </button>
  );
}
