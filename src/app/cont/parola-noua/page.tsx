import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewPasswordForm } from "./NewPasswordForm";

// Pagina din linkul „Ai uitat parola?" (după /auth/callback, sesiunea de resetare e deja în cookie).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("newPassword.title"), robots: { index: false } };
}

export default function NewPasswordPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <NewPasswordForm />
    </main>
  );
}
