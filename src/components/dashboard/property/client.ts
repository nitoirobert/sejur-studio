"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/components/dashboard/chart/format";
import type { ActionResult } from "./schema";

type Failure = Extract<ActionResult, { ok: false }>;

/**
  One server action at a time for a form: pending state, the last failure, and messages for it.
  The action itself calls refresh(), so the page data is new by the time `pending` turns false.
*/
export function useSave() {
  const t = useTranslations("Dashboard.properties");
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = useCallback(<T extends object>(action: () => Promise<ActionResult<T>>, onOk?: (r: { ok: true } & T) => void) => {
    setFailure(null);
    startTransition(async () => {
      let r: ActionResult<T>;
      try {
        r = await action();
      } catch {
        r = { ok: false, code: "generic" };
      }
      if (r.ok) onOk?.(r);
      else setFailure(r);
    });
  }, []);

  /** The message under a field, when the failure names it. */
  const fieldError = (field: string): string | null =>
    failure?.code === "invalid_field" && failure.field === field ? t(`fieldErrors.${field}` as "fieldErrors.name") : null;

  /** The message for the whole form (null when a field message covers it). */
  const formError =
    failure && !(failure.code === "invalid_field" && failure.field) ? t(`formErrors.${failure.code}`) : null;

  return { pending, failure, run, fieldError, formError, clear: () => setFailure(null) };
}

/** Bani -> "450,50 lei". */
export const lei = (bani: number, label = "lei") => formatMoney(bani, "RON", label);

/** Bani -> the text an input shows back: 45050 -> "450,50", 30000 -> "300". */
export function baniToInput(bani: number | null | undefined): string {
  if (bani === null || bani === undefined) return "";
  const whole = Math.floor(bani / 100);
  const cents = bani % 100;
  return cents === 0 ? String(whole) : `${whole},${String(cents).padStart(2, "0")}`;
}
