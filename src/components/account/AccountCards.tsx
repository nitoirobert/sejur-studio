import type { ReactNode } from "react";
import { card } from "@/components/ui/soft";

// Building blocks of the account pages. The menu, back link and section title live in
// src/app/cont/(account)/layout.tsx, kept mounted between sections.

// Shared look of one block inside a section.
export function AccountCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {sub && <p className="mt-1 max-w-prose text-sm text-ink-soft">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// One titled block with a hairline under the heading; several of them go inside one `card`.
export function AccountBlock({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="border-b border-sand-200 pb-2.5 font-serif text-xl text-ink">{title}</h2>
      {sub && <p className="mt-2 text-sm text-ink-soft">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const accountSkeleton = <div className={`${card} h-48 animate-pulse`} aria-hidden />;
