"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Cookie, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { COOKIE_SETTINGS_EVENT, saveConsent, useConsent } from "@/lib/consent";

/*
  Fereastra de cookie-uri: un card în mijlocul ecranului, cu pagina estompată în spate.
  Apare la 2 secunde după intrare, doar dacă vizitatorul n-a ales încă.
  „Doar necesare" are aceeași greutate ca „Accept toate" (cerință GDPR: refuzul la fel de ușor ca acordul).
*/

const DELAY_MS = 2000;

export function CookieConsent() {
  const t = useTranslations("Cookies");
  const consent = useConsent();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [choice, setChoice] = useState({ analytics: false, marketing: false });

  // Prima vizită: apare după 2 secunde
  useEffect(() => {
    if (consent !== null) return; // undefined = încă nu știm; altfel a ales deja
    const id = window.setTimeout(() => setOpen(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [consent]);

  // Redeschidere din „Setări cookie-uri"
  useEffect(() => {
    const reopen = () => {
      setChoice({
        analytics: !!consent?.analytics,
        marketing: !!consent?.marketing,
      });
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen);
  }, [consent]);

  const decide = (c: { analytics: boolean; marketing: boolean }) => {
    saveConsent(c);
    setOpen(false);
    setDetails(false);
  };

  const button =
    "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-[background-color,box-shadow,translate] duration-200 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cookie-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.3 }}
          className="fixed inset-0 z-[55] grid place-items-center bg-[#0b1220]/20 p-4 backdrop-blur-md"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-title"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="w-[min(26rem,100%)] rounded-card border border-white/60 bg-cream-50 p-6 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-star/25 text-[#9a6a12]">
                <Cookie className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="cookie-title"
                  className="font-serif text-lg leading-tight text-ink"
                >
                  {t("title")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {t("text")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => decide({ analytics: false, marketing: false })}
                aria-label={t("close")}
                title={t("close")}
                className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-cream-100 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {details && (
                <motion.div
                  key="details"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ul className="mt-4 space-y-2">
                    <Category
                      title={t("necessary.title")}
                      text={t("necessary.text")}
                      checked
                      disabled
                      label={t("alwaysOn")}
                    />
                    <Category
                      title={t("analytics.title")}
                      text={t("analytics.text")}
                      checked={choice.analytics}
                      onChange={(v) =>
                        setChoice((c) => ({ ...c, analytics: v }))
                      }
                    />
                    <Category
                      title={t("marketing.title")}
                      text={t("marketing.text")}
                      checked={choice.marketing}
                      onChange={(v) =>
                        setChoice((c) => ({ ...c, marketing: v }))
                      }
                    />
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex gap-2">
              {details ? (
                <button
                  type="button"
                  onClick={() => decide(choice)}
                  className={`${button} bg-accent text-cream-50 shadow-accent hover:bg-accent-600`}
                >
                  {t("save")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      decide({ analytics: false, marketing: false })
                    }
                    className={`${button} bg-cream-100 text-ink shadow-pill ring-1 ring-sand hover:bg-cream-200`}
                  >
                    {t("necessaryOnly")}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide({ analytics: true, marketing: true })}
                    className={`${button} bg-accent text-cream-50 shadow-accent hover:bg-accent-600`}
                  >
                    {t("acceptAll")}
                  </button>
                </>
              )}
            </div>
            {!details && (
              <button
                type="button"
                onClick={() => setDetails(true)}
                className="mt-2 w-full text-center text-xs font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              >
                {t("customize")}
              </button>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Category({
  title,
  text,
  checked,
  disabled,
  label,
  onChange,
}: {
  title: string;
  text: string;
  checked: boolean;
  disabled?: boolean;
  label?: string;
  onChange?: (v: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl bg-cream-100 px-3.5 py-2.5 shadow-pressed">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs leading-snug text-muted">{text}</span>
      </span>
      {disabled ? (
        <span className="shrink-0 pt-0.5 text-[11px] font-semibold text-accent">
          {label}
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          onClick={() => onChange?.(!checked)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-sand-200"}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-cream-50 shadow-pill transition-[left] duration-200 ${checked ? "left-[1.375rem]" : "left-0.5"}`}
          />
        </button>
      )}
    </li>
  );
}
