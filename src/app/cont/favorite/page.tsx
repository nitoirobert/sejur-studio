import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getPublishedUnits } from "@/lib/catalog/server";
import { card } from "@/components/ui/soft";
import { AccountShell } from "@/components/booking/AccountShell";
import { FavoritesList } from "@/components/booking/FavoritesList";

// The account's hearts. Rows come from `favorites` (RLS: own rows only); the unit details from the
// public catalogue, so a unit hidden since then simply drops out.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("favoritesTitle"), robots: { index: false } };
}

export default function FavoritesPage() {
  return (
    <AccountShell active="favorites">
      <Suspense fallback={<div className={`${card} h-48 animate-pulse`} aria-hidden />}>
        <Favorites />
      </Suspense>
    </AccountShell>
  );
}

async function Favorites() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/cont/favorite")}`);

  const [{ data: rows }, units] = await Promise.all([
    supabase.from("favorites").select("unit_id").order("created_at", { ascending: false }).limit(500),
    getPublishedUnits(),
  ]);
  const byId = new Map(units.map((u) => [u.id, u]));
  const list = (rows ?? []).flatMap((r) => {
    const u = byId.get(r.unit_id);
    return u ? [u] : [];
  });
  return <FavoritesList units={list} />;
}
