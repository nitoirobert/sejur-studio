import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { panel } from "@/components/dashboard/property/ui";
import { pill } from "@/components/ui/soft";

// A property that does not exist or belongs to another organization: the same answer for both.
export default async function PropertyNotFound() {
  const t = await getTranslations("Dashboard.properties.notFound");
  return (
    <div className="px-4 pt-4 pb-10 md:px-6 md:pt-6 xl:pt-8">
      <section
        data-testid="property-not-found"
        className={`${panel} flex max-w-2xl flex-col items-start gap-5 p-6 sm:p-9 md:flex-row md:items-center md:gap-8`}
      >
        <span className="grid size-20 shrink-0 place-items-center rounded-[1.6rem] bg-cream-50/80 text-accent shadow-pill">
          <SearchX className="size-9" strokeWidth={1.6} aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-[2rem] leading-tight text-ink">{t("title")}</h1>
          <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">{t("body")}</p>
          <Link href="/dashboard/proprietati" className={`${pill} mt-5 h-11 px-4`}>
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
        </div>
      </section>
    </div>
  );
}
