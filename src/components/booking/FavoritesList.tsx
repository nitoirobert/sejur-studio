"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { card, pill } from "@/components/ui/soft";
import { usePrice } from "@/components/browse/use-price";
import { useFavorites } from "@/lib/booking/favorites";
import { useLocalizeUnit } from "@/lib/use-units";
import type { Unit } from "@/lib/mock-units";
import { FavoriteButton } from "./FavoriteButton";

// The account's favourites. A heart taken off here disappears from the list at once.
export function FavoritesList({ units }: { units: Unit[] }) {
  const t = useTranslations("Account");
  const tProperty = useTranslations("Property");
  const price = usePrice();
  const localize = useLocalizeUnit();
  const { ready, ids } = useFavorites();
  const shown = ready ? units.filter((u) => ids.has(u.id)) : units;

  if (shown.length === 0) {
    return (
      <div className={`${card} p-6 text-center`}>
        <p className="text-sm text-ink-soft">{t("favoritesEmpty")}</p>
        <Link href="/" className={`${pill} mt-4 px-4 py-2.5`}>
          {t("search")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {shown.map((base) => {
        const u = localize(base);
        return (
          <li key={u.id} className={`${card} relative flex gap-4 p-3`} data-testid="favorite">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-inner bg-cream-100">
              <Image src={u.photos[0]} alt="" fill sizes="96px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1 py-1 pr-10">
              <Link href={`/cazare/${u.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                {u.name}
              </Link>
              <p className="truncate text-sm text-ink-soft">{u.location || u.propertyName}</p>
              <p className="mt-2 text-sm text-ink">
                <span className="font-bold">{price(u.pricePerNight)}</span>{" "}
                <span className="text-muted">/ {tProperty("perNight")}</span>
              </p>
            </div>
            <div className="absolute top-3 right-3">
              <FavoriteButton unitId={u.id} name={u.name} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
