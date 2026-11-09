import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/dashboard/auth/AuthForm";
import { AuthFormSkeleton, AuthShell } from "@/components/dashboard/auth/AuthShell";
import { PASSWORD_MIN } from "@/lib/supabase/validation";
import { signup } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: `${t("auth.signupTitle")} · ${t("brand")}`, robots: { index: false } };
}

export default async function SignupPage() {
  const t = await getTranslations("Dashboard.auth");
  return (
    <AuthShell title={t("signupTitle")} subtitle={t("signupSub")}>
      <Suspense fallback={<AuthFormSkeleton fields={3} />}>
        <AuthForm mode="signup" action={signup} passwordMin={PASSWORD_MIN} />
      </Suspense>
    </AuthShell>
  );
}
