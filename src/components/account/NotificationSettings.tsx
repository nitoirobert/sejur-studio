"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { NOTIFY_KEYS, type NotifyKey, type NotifyPrefs } from "@/lib/account/notify";
import { FormMessage, Toggle } from "./ui";

// Email notification switches. Each change is saved at once in user_metadata.notify.
export function NotificationSettings({ email, initial }: { email: string | null; initial: NotifyPrefs }) {
  const t = useTranslations("Account.notify");
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<NotifyKey | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const change = async (key: NotifyKey, value: boolean) => {
    const before = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(key);
    setMsg(null);
    const { error } = await createClient()
      .auth.updateUser({ data: { notify: next } })
      .catch(() => ({ error: true }));
    setSaving(null);
    if (error) {
      setPrefs(before);
      return setMsg({ kind: "error", text: t("error") });
    }
    setMsg({ kind: "ok", text: t("saved") });
  };

  return (
    <div>
      <p className="text-sm text-ink-soft">{t("channel", { email: email ?? "" })}</p>
      <ul className="mt-4 divide-y divide-sand-200">
        <li className="flex items-start justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{t("booking.title")}</p>
            <p className="mt-0.5 max-w-prose text-sm text-ink-soft">{t("booking.text")}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <Lock className="size-3.5" />
            {t("always")}
          </span>
        </li>
        {NOTIFY_KEYS.map((key) => (
          <li key={key} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{t(`${key}.title`)}</p>
              <p className="mt-0.5 max-w-prose text-sm text-ink-soft">{t(`${key}.text`)}</p>
            </div>
            <Toggle
              checked={prefs[key]}
              onChange={(v) => change(key, v)}
              disabled={saving !== null}
              label={t(`${key}.title`)}
            />
          </li>
        ))}
      </ul>
      <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
    </div>
  );
}
