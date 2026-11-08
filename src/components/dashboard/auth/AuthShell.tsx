import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/browse/ThemeToggle";
import { pill } from "@/components/ui/soft";

// Login / sign-up frame: a glass card on the left third, the beach stays visible on the right.
export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("Dashboard");
  return (
    <div className="flex min-h-dvh flex-col px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className={`${pill} h-11 px-4`}>
          <ArrowLeft className="size-4" aria-hidden />
          {t("auth.back")}
        </Link>
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center py-8">
        <section
          aria-labelledby="auth-title"
          className="w-full max-w-[27rem] rounded-card border border-glass-line bg-glass-strong p-6 shadow-glass backdrop-blur-2xl backdrop-saturate-150 sm:p-9"
        >
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={88}
              height={88}
              sizes="44px"
              className="size-11 rounded-full shadow-pill"
              priority
            />
            <div className="leading-tight">
              <p className="font-brand text-lg font-semibold text-ink">{t("brand")}</p>
              <p className="text-xs font-medium text-ink-soft">{t("brandSub")}</p>
            </div>
          </div>

          <h1 id="auth-title" className="mt-8 font-serif text-[2.5rem] leading-[1.05] text-balance text-ink">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-pretty text-ink-soft">{subtitle}</p>

          <div className="mt-7">{children}</div>
        </section>
      </main>
    </div>
  );
}

// Same height as the form, shown while the URL (?next=) is read.
export function AuthFormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="ml-1 h-4 w-20 rounded-full bg-sand/70" />
          <div className="h-12 rounded-inner bg-cream-100/70 shadow-pressed" />
        </div>
      ))}
      <div className="h-12 rounded-full bg-accent/80" />
    </div>
  );
}
