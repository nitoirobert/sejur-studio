"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorKey } from "@/lib/supabase/errors";
import { safeNext, signupSchema } from "@/lib/supabase/validation";
import type { AuthFieldErrors, AuthFormState } from "@/components/dashboard/auth/types";

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = {
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const parsed = signupSchema.safeParse({ ...values, password: formData.get("password") ?? "" });
  if (!parsed.success) {
    const fields: AuthFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof AuthFieldErrors;
      fields[field] ??= issue.message as AuthFieldErrors[typeof field];
    }
    return { fields, values };
  }

  const { email, password, full_name } = parsed.data;
  const supabase = await createClient();
  // The auth.users trigger creates the organization, the owner membership and the profile
  // (it reads only full_name from metadata). Email confirmation is off, so a session comes back.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });
  if (error) {
    const key = authErrorKey(error, "signup");
    if (key === "passwordShort") return { fields: { password: key }, values };
    if (key === "emailInvalid") return { fields: { email: key }, values };
    return { error: key, values };
  }
  if (!data.session) return { error: "generic", values };

  redirect(safeNext(formData.get("next")));
}
