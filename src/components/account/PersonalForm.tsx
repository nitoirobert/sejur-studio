"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Field, FormMessage, Spinner, inputClass, saveButtonSm } from "./ui";

const PHONE = /^\+?[0-9][0-9 ()./-]{5,18}[0-9]$/;

// Name and phone, saved in auth user_metadata (full_name, phone). The phone fills the booking form.
export function PersonalForm({ name, phone }: { name: string | null; phone: string | null }) {
  const t = useTranslations("Account.personal");
  const router = useRouter();
  const [values, setValues] = useState({ name: name ?? "", phone: phone ?? "" });
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const fullName = values.name.trim().replace(/\s+/g, " ");
    const tel = values.phone.trim();
    const next: typeof errors = {};
    if (!fullName) next.name = t("errors.nameEmpty");
    else if (fullName.length > 80) next.name = t("errors.nameLong");
    if (tel && !PHONE.test(tel)) next.phone = t("errors.phone");
    setErrors(next);
    if (next.name || next.phone) return;

    setPending(true);
    const { error } = await createClient()
      .auth.updateUser({ data: { full_name: fullName, phone: tel || null } })
      .catch(() => ({ error: true }));
    setPending(false);
    if (error) return setMsg({ kind: "error", text: t("errors.generic") });
    setMsg({ kind: "ok", text: t("saved") });
    router.refresh();
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} error={errors.name}>
          <input
            autoComplete="name"
            maxLength={80}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            aria-invalid={!!errors.name}
            className={inputClass}
          />
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} error={errors.phone}>
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={20}
            placeholder="+40 7xx xxx xxx"
            value={values.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
            aria-invalid={!!errors.phone}
            className={inputClass}
          />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={`${saveButtonSm} mt-4`}>
        <Spinner on={pending}>{null}</Spinner>
        {t("save")}
      </button>
      <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
    </form>
  );
}
