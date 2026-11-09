import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notDeployed, requireAccountUser } from "@/lib/account/server";
import { AccountCard, accountSkeleton } from "@/components/account/AccountCards";

// Payments: saved cards (Stripe, brief 08: card data never touches our servers or database)
// and the history of the caller's payments from my_payments() (0016_guest_profile.sql).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("payments.title"), robots: { index: false } };
}

export default function PaymentsPage() {
  return (
    <>
      <div className="space-y-5">
        <Cards />
        <Suspense fallback={accountSkeleton}>
          <History />
        </Suspense>
      </div>
    </>
  );
}

// Saved cards arrive with Stripe (decision 12): a Stripe Customer per account, cards added through
// Stripe's own form (SetupIntent). Until then: an honest empty state, no fake form.
async function Cards() {
  const t = await getTranslations("Account.payments");
  return (
    <AccountCard title={t("cardsTitle")} sub={t("cardsSub")}>
      <div className="flex flex-col gap-4 rounded-2xl bg-cream-100 p-5 shadow-pressed sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream-50 text-accent shadow-pill">
          <CreditCard className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">{t("cardsEmpty")}</p>
          <p className="mt-0.5 max-w-prose text-sm text-ink-soft">{t("cardsSoon")}</p>
        </div>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="size-4 shrink-0 text-accent" />
        {t("secure")}
      </p>
    </AccountCard>
  );
}

const STATUS_STYLE: Record<string, string> = {
  succeeded: "bg-accent text-cream-50",
  pending: "bg-star text-ink",
  failed: "bg-red-100 text-red-900",
  refunded: "bg-cream-200 text-ink",
  partially_refunded: "bg-cream-200 text-ink",
};

async function History() {
  await requireAccountUser("/cont/plati");
  const supabase = await createClient();
  const [t, format] = await Promise.all([getTranslations("Account.payments"), getFormatter()]);
  const { data, error } = await supabase.rpc("my_payments", { p_limit: 50, p_offset: 0 });

  const money = (amount: number, currency: string) =>
    format.number(amount / 100, { style: "currency", currency, maximumFractionDigits: 2 });

  return (
    <AccountCard title={t("historyTitle")}>
      {error && !notDeployed(error) ? (
        <p role="alert" className="text-sm text-ink-soft">{t("loadError")}</p>
      ) : !data?.length ? (
        <p className="text-sm text-ink-soft">{t("historyEmpty")}</p>
      ) : (
        <ul className="divide-y divide-sand-200">
          {data.map((p) => (
            <li key={p.payment_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{p.property_name}</p>
                <p className="text-sm text-ink-soft">
                  {p.unit_name} · {format.dateTime(new Date(p.created_at), { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <Link
                  href={`/rezervare/${p.booking_public_token}`}
                  prefetch={false}
                  className="mt-1 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  {t("viewBooking")}
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-pill ${STATUS_STYLE[p.status] ?? STATUS_STYLE.pending}`}>
                  {t(`status.${p.status}`)}
                </span>
                <span className="text-right">
                  <span className="block font-semibold text-ink tabular-nums">{money(p.amount, p.currency)}</span>
                  {p.refunded_amount > 0 && (
                    <span className="block text-xs text-ink-soft tabular-nums">
                      {t("refunded", { amount: money(p.refunded_amount, p.currency) })}
                    </span>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountCard>
  );
}
