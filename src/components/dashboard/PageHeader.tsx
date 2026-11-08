import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/browse/ThemeToggle";
import { getViewer } from "@/lib/supabase/dal";
import { MenuButton } from "./Sidebar";

// Serif page title + greeting; the day/night switch on the right. No toolbar.
// Phone: ☰ and the switch share the first row, the title box takes the full width below.
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-wrap items-start gap-3">
      <MenuButton />
      <div className="order-last min-w-0 basis-full md:order-none md:flex-1 md:basis-0">
        {/* Veil: keeps title and greeting at AA over any part of the scene (moon, sun, foam).
            One width from xl up (ends on the second KPI card's right edge at 1440). */}
        <div className="max-w-full rounded-[1.5rem] md:w-fit xl:w-[34.75rem] border border-glass-line bg-veil px-4 py-3 shadow-glass backdrop-blur-md backdrop-saturate-150 md:px-5">
          <h1 className="font-serif text-[2.25rem] leading-[1.05] text-balance text-ink md:text-5xl">{title}</h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-pretty text-ink-soft">
            <Suspense fallback={<span className="inline-block h-[1em] w-24 rounded-full bg-cream-100/70 align-middle" />}>
              <Greeting />
            </Suspense>{" "}
            {subtitle}
          </p>
        </div>
      </div>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}

async function Greeting() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("Dashboard")]);
  return (
    <>
      <strong data-testid="greeting" className="font-semibold text-ink">
        {viewer?.firstName ? t("greeting", { name: viewer.firstName }) : t("greetingAnon")}
      </strong>
      .
    </>
  );
}
