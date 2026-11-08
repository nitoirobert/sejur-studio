import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export type Viewer = { id: string; firstName: string | null; isHost: boolean };

// The verified user for this request (asks the Auth server; never trusts getSession()).
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", data.user.id).maybeSingle(),
    // Host = member of an organization (RLS returns only the user's own memberships).
    // Guest accounts (0010_guest_accounts) have none.
    supabase.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("user_id", data.user.id),
  ]);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null;
  return { id: data.user.id, firstName, isHost: (count ?? 0) > 0 };
});

// Every dashboard page and action calls this before touching data.
// A signed-in guest (client account from the public site) has no panel: back to the site.
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isHost) redirect("/");
  return viewer;
}
