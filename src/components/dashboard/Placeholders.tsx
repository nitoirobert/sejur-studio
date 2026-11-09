import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { pill } from "@/components/ui/soft";
import { KpiSkeleton } from "./KpiCards";

const panel = "rounded-card border border-glass-line bg-glass shadow-glass backdrop-blur-xl backdrop-saturate-150";

function SoonChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-accent-50 px-3 text-xs font-semibold text-accent">
      {label}
    </span>
  );
}

// While the overview loads: the KPI row, the chart box and the two side panels.
export function OverviewSkeleton({ withoutKpis = false }: { withoutKpis?: boolean } = {}) {
  return (
    <div aria-hidden data-testid="overview-skeleton">
      {!withoutKpis && <KpiSkeleton />}
      <div className={`${panel} mt-4 h-[28rem] md:mt-5`} />
      <div className="mt-4 grid gap-4 md:mt-5 md:grid-cols-2 md:gap-5">
        <div className={`${panel} h-56`} />
        <div className={`${panel} h-56`} />
      </div>
    </div>
  );
}

// The 3 pages that arrive in later steps.
export async function ComingSoon({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const t = await getTranslations("Dashboard");
  return (
    <section data-testid="empty-state" className={`${panel} flex flex-col items-start gap-5 p-6 sm:p-9 md:flex-row md:items-center md:gap-8`}>
      <span className="grid size-20 shrink-0 place-items-center rounded-[1.6rem] bg-cream-50/80 text-accent shadow-pill md:size-24">
        <Icon className="size-9 md:size-10" strokeWidth={1.6} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="font-serif text-2xl leading-tight text-balance text-ink md:text-[1.75rem]">{title}</h2>
          <SoonChip label={t("soon")} />
        </div>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-pretty text-ink-soft">{body}</p>
        <Link href="/dashboard" className={`${pill} mt-5 h-11 px-4`}>
          <ArrowLeft className="size-4" aria-hidden />
          {t("backToOverview")}
        </Link>
      </div>
    </section>
  );
}

export function PanelSkeleton() {
  return <div aria-hidden className={`${panel} h-56`} />;
}
