"use client";

import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { loadPendingCount } from "@/app/dashboard/rezervari/actions";

/*
  Number of booking requests waiting for the owner (pending_requests_count), shown on "Rezervări".
  Loaded on mount, on every route change and when the tab comes back to the front. The list on
  /dashboard/rezervari pushes its own total (same predicate) and the optimistic -1 of a click, so
  the number drops without a reload.
*/

type Ctx = {
  count: number | null;
  /** A known total (the list's total_count); wins over a background load still in flight. */
  set: (n: number) => void;
  /** Optimistic change while a confirm/decline is on its way. */
  shift: (delta: number) => void;
  reload: () => void;
};

const BadgeContext = createContext<Ctx | null>(null);

export function usePendingBadge(): Ctx | null {
  return use(BadgeContext);
}

export function PendingBadgeProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState<number | null>(null);
  const seq = useRef(0);
  const pathname = usePathname();

  const reload = useCallback(() => {
    const id = ++seq.current;
    loadPendingCount()
      .then((n) => {
        if (id === seq.current && n !== null) setCount(n);
      })
      .catch(() => {
        // offline or the action failed: keep the number shown
      });
  }, []);

  const set = useCallback((n: number) => {
    seq.current++;
    setCount(Math.max(0, n));
  }, []);

  const shift = useCallback((delta: number) => {
    seq.current++;
    setCount((c) => (c === null ? c : Math.max(0, c + delta)));
  }, []);

  useEffect(() => {
    reload();
  }, [pathname, reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  return <BadgeContext value={{ count, set, shift, reload }}>{children}</BadgeContext>;
}

/**
 * The small number on the "Rezervări" icon; nothing while unknown or zero. The digits are CSS
 * content so the link's text stays "Rezervări"; screen readers get the count from PendingBadgeText
 * through aria-describedby.
 */
export function PendingBadge() {
  const count = usePendingBadge()?.count ?? 0;
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      data-testid="pending-badge"
      data-count={count > 99 ? "99+" : count}
      className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-star px-1 text-[11px] leading-none font-bold text-[#1b2a44] tabular-nums ring-2 ring-cream-50 after:content-[attr(data-count)]"
    />
  );
}

/** id for aria-describedby on the "Rezervări" link, or undefined when there is nothing to say. */
export function usePendingBadgeId(id: string): string | undefined {
  const count = usePendingBadge()?.count ?? 0;
  return count > 0 ? id : undefined;
}

export function PendingBadgeText({ id }: { id: string }) {
  const t = useTranslations("Dashboard.requests");
  const count = usePendingBadge()?.count ?? 0;
  if (count <= 0) return null;
  return (
    <span id={id} hidden>
      {t("badge", { count })}
    </span>
  );
}
