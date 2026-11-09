"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { guestSignOut } from "@/lib/auth/guest";
import { AVATAR_BUCKET } from "@/lib/avatar";
import { PASSWORD_MIN } from "@/lib/supabase/validation";
import { Field, FormMessage, SettingRow, Spinner, dangerButtonSm, inputClass, saveButtonSm, secondaryButtonSm } from "./ui";

type Msg = { kind: "error" | "ok"; text: string } | null;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// New email: Supabase sends a confirmation link to the new address (and, with "secure email change",
// to the old one too). The address changes only after the click.
export function EmailForm({ email, pendingEmail }: { email: string | null; pendingEmail: string | null }) {
  const t = useTranslations("Account.email");
  const tPersonal = useTranslations("Account.personal");
  const tDanger = useTranslations("Account.danger");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<Msg>(pendingEmail ? { kind: "ok", text: t("pending", { email: pendingEmail }) } : null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = value.trim().toLowerCase();
    if (!EMAIL.test(next)) return setMsg({ kind: "error", text: t("errors.invalid") });
    if (next === email) return setMsg({ kind: "error", text: t("errors.same") });
    setPending(true);
    setMsg(null);
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/cont")}`;
    const { error } = await createClient()
      .auth.updateUser({ email: next }, { emailRedirectTo: redirect })
      .catch(() => ({ error: { code: "unexpected" } as { code?: string } }));
    setPending(false);
    if (error) {
      const code = "code" in error ? error.code : undefined;
      const key = code === "email_exists" ? "taken" : code === "over_email_send_rate_limit" ? "rateLimit" : "generic";
      return setMsg({ kind: "error", text: t(`errors.${key}`) });
    }
    setValue("");
    setEditing(false);
    setMsg({ kind: "ok", text: t("sent", { email: next }) });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
        <div className="w-full sm:max-w-sm">
          <Field label={t("title")}>
            {editing ? (
              <input
                type="email"
                autoComplete="email"
                placeholder={t("new")}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={inputClass}
              />
            ) : (
              <input readOnly tabIndex={-1} value={email ?? ""} className={`${inputClass} text-ink-soft`} />
            )}
          </Field>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button type="submit" disabled={pending || !value.trim()} className={saveButtonSm}>
              <Spinner on={pending}>{null}</Spinner>
              {tPersonal("save")}
            </button>
            <button type="button" onClick={() => (setEditing(false), setValue(""))} className={secondaryButtonSm}>
              {tDanger("cancel")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButtonSm}>
            {t("submit")}
          </button>
        )}
      </div>
      <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
    </form>
  );
}

// New password, only for accounts with email + password sign-in.
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("Account.password");
  const tPersonal = useTranslations("Account.personal");
  const tDanger = useTranslations("Account.danger");
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, setPending] = useState(false);

  if (!hasPassword) return <p className="text-sm text-ink-soft">{t("social")}</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (values.password.length < PASSWORD_MIN) return setMsg({ kind: "error", text: t("errors.short", { min: PASSWORD_MIN }) });
    if (values.password.length > 72) return setMsg({ kind: "error", text: t("errors.long") });
    if (values.password !== values.confirm) return setMsg({ kind: "error", text: t("errors.mismatch") });
    setPending(true);
    const { error } = await createClient()
      .auth.updateUser({ password: values.password })
      .catch(() => ({ error: { code: "unexpected" } as { code?: string } }));
    setPending(false);
    if (error) {
      const code = "code" in error ? error.code : undefined;
      const key =
        code === "same_password" ? "same" : code === "weak_password" ? "weak" : code === "reauthentication_needed" ? "reauth" : "generic";
      return setMsg({ kind: "error", text: t(`errors.${key}`, { min: PASSWORD_MIN }) });
    }
    setValues({ password: "", confirm: "" });
    setEditing(false);
    setMsg({ kind: "ok", text: t("saved") });
  };

  const input = (field: "password" | "confirm", label: string) => (
    <Field label={label}>
      <span className="relative block">
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          maxLength={72}
          value={values[field]}
          onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
          className={`${inputClass} pr-12`}
        />
        {field === "password" && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t("hide") : t("show")}
            className="absolute top-1/2 right-3 mt-[3px] -translate-y-1/2 p-1 text-ink-soft hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </span>
    </Field>
  );

  if (!editing) {
    return (
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="w-full sm:max-w-sm">
            <Field label={t("title")}>
              <input readOnly tabIndex={-1} value="••••••••••" className={`${inputClass} text-ink-soft`} />
            </Field>
          </div>
          <button type="button" onClick={() => setEditing(true)} className={secondaryButtonSm}>
            {t("submit")}
          </button>
        </div>
        <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {input("password", t("new"))}
        {input("confirm", t("confirm"))}
      </div>
      <p className="mt-2 text-xs text-muted">{t("hint", { min: PASSWORD_MIN })}</p>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pending || !values.password} className={saveButtonSm}>
          <Spinner on={pending}>{null}</Spinner>
          {tPersonal("save")}
        </button>
        <button
          type="button"
          onClick={() => (setEditing(false), setValues({ password: "", confirm: "" }), setMsg(null))}
          className={secondaryButtonSm}
        >
          {tDanger("cancel")}
        </button>
      </div>
      <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
    </form>
  );
}

// Sign out + delete account. Host accounts cannot delete themselves here (their properties and
// bookings belong to the organization): the button is replaced by a note.
export function AccountActions({ userId, email, isHost }: { userId: string; email: string | null; isHost: boolean }) {
  const t = useTranslations("Account.danger");
  const tAuth = useTranslations("Auth.account");
  const router = useRouter();
  const [busy, setBusy] = useState<null | "signOut" | "delete">(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const word = t("confirmWord");

  const signOut = async () => {
    setBusy("signOut");
    await guestSignOut().catch(() => {});
    router.push("/");
    router.refresh();
  };

  const remove = async () => {
    setBusy("delete");
    setMsg(null);
    const supabase = createClient();
    await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.webp`]).catch(() => {});
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(null);
      return setMsg({ kind: "error", text: t(error.message === "host_account" ? "errors.host" : "errors.generic") });
    }
    await supabase.auth.signOut().catch(() => {});
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <SettingRow
        title={tAuth("signOut")}
        text={t("signOutText")}
        action={
          <button type="button" disabled={!!busy} onClick={signOut} className={secondaryButtonSm}>
            <Spinner on={busy === "signOut"}>
              <LogOut className="size-4" />
            </Spinner>
            {tAuth("signOut")}
          </button>
        }
      />

      <div>
        <SettingRow
          title={t("title")}
          text={isHost ? t("hostNote") : t("text")}
          danger
          action={
            !isHost && !confirming ? (
              <button type="button" onClick={() => setConfirming(true)} className={dangerButtonSm}>
                <Trash2 className="size-4" />
                {t("open")}
              </button>
            ) : undefined
          }
        />
        {!isHost && confirming && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-72">
              <Field label={t("confirmLabel", { word, email: email ?? "" })}>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} autoComplete="off" />
              </Field>
            </div>
            <button
              type="button"
              disabled={typed.trim().toUpperCase() !== word.toUpperCase() || !!busy}
              onClick={remove}
              className={dangerButtonSm}
            >
              <Spinner on={busy === "delete"}>
                <Trash2 className="size-4" />
              </Spinner>
              {t("submit")}
            </button>
            <button type="button" onClick={() => (setConfirming(false), setTyped(""))} className={secondaryButtonSm}>
              {t("cancel")}
            </button>
          </div>
        )}
        <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
      </div>
    </div>
  );
}
