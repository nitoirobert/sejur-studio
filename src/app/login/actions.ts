"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorKey } from "@/lib/supabase/errors";
import { loginSchema, safeNext } from "@/lib/supabase/validation";
import type { AuthFormState } from "@/components/dashboard/auth/types";

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") ?? "" });
  // One message for every wrong email / password case, so the form does not reveal which part was wrong.
  if (!parsed.success) return { error: "invalidCredentials", values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorKey(error, "login"), values: { email } };

  redirect(safeNext(formData.get("next")));
}
