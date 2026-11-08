import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const TABS = ["detalii", "unitati", "poze", "preturi"] as const;
export type TabKey = (typeof TABS)[number];

const LABEL: Record<TabKey, "details" | "units" | "photos" | "prices"> = {
  detalii: "details",
  unitati: "units",
  poze: "photos",
  preturi: "prices",
};

export function parseTab(raw: string | string[] | undefined): TabKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (TABS as readonly string[]).includes(v ?? "") ? (v as TabKey) : "detalii";
}

/*
  The four sections as links (?tab=), so every tab has its own URL and survives a reload.
  Phone: one row that scrolls sideways; the bleed to the screen edges keeps the last tab reachable.
*/
export async function PropertyTabs({ propertyId, active }: { propertyId: string; active: TabKey }) {
  const t = await getTranslations("Dashboard.properties.tabs");
  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="inline-flex min-w-max gap-1 rounded-full border border-glass-line bg-glass p-1 shadow-glass backdrop-blur-xl">
        {TABS.map((tab) => {
          const on = tab === active;
          return (
            <li key={tab}>
              <Link
                href={tab === "detalii" ? `/dashboard/proprietati/${propertyId}` : `/dashboard/proprietati/${propertyId}?tab=${tab}`}
                aria-current={on ? "page" : undefined}
                data-testid={`property-tab-${tab}`}
                scroll={false}
                className={`inline-flex h-11 items-center rounded-full px-5 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  on
                    ? "bg-accent text-cream-50 shadow-sm dark:bg-accent-strong dark:text-[#0d1626]"
                    : "text-ink-soft hover:bg-cream-50/70 hover:text-ink"
                }`}
              >
                {t(LABEL[tab])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
