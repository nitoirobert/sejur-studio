import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export type Viewer = { id: string; firstName: string | null };

// The verified user for this request (asks the Auth server; never trusts getSession()).
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", data.user.id)
    .maybeSingle();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null;
  return { id: data.user.id, firstName };
});

// Every dashboard page and action calls this before touching data.
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}
