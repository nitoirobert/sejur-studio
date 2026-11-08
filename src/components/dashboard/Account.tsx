import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/supabase/dal";

// Avatar (initial) + first name at the bottom of the menu.
export async function Account() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("Dashboard")]);
  const name = viewer?.firstName ?? t("account");
  return (
    <div className="flex items-center gap-3 p-1.5" title={name}>
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-50 font-serif text-lg text-accent shadow-pill"
      >
        {name.charAt(0).toLocaleUpperCase("ro-RO")}
      </span>
      <span data-account-name className="min-w-0 truncate text-[15px] font-semibold text-ink">
        {name}
      </span>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="flex items-center gap-3 p-1.5" aria-hidden>
      <span className="size-11 shrink-0 rounded-full bg-cream-100/80" />
      <span data-account-name className="h-4 w-20 rounded-full bg-cream-100/80" />
    </div>
  );
}
