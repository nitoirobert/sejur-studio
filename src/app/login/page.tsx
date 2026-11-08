import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/dashboard/auth/AuthForm";
import { AuthFormSkeleton, AuthShell } from "@/components/dashboard/auth/AuthShell";
import { PASSWORD_MIN } from "@/lib/supabase/validation";
import { login } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: `${t("auth.loginTitle")} · ${t("brand")}`, robots: { index: false } };
}

export default async function LoginPage() {
  const t = await getTranslations("Dashboard.auth");
  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSub")}>
      <Suspense fallback={<AuthFormSkeleton fields={2} />}>
        <AuthForm mode="login" action={login} passwordMin={PASSWORD_MIN} />
      </Suspense>
    </AuthShell>
  );
}
