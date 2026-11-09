"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { primaryButton } from "@/components/ui/soft";

// Error state for any /dashboard page. Never shows the raw error.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Dashboard.error");
  return (
    <div className="px-4 pt-4 pb-10 md:px-6 md:pt-6 xl:pt-8">
      <section
        role="alert"
        className="max-w-2xl rounded-card border border-glass-line bg-glass-strong p-6 shadow-glass backdrop-blur-xl sm:p-9"
      >
        <h1 className="font-serif text-[2rem] leading-tight text-ink">{t("title")}</h1>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">{t("body")}</p>
        <button type="button" onClick={reset} className={`${primaryButton} mt-6 min-h-12`}>
          <RotateCcw className="size-4" aria-hidden />
          {t("retry")}
        </button>
      </section>
    </div>
  );
}
