import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avatarOf } from "@/lib/avatar";
import { readNotifyPrefs, type NotifyPrefs } from "@/lib/account/notify";

// The signed-in user for the /cont pages, once per request. Every account is a guest here:
// a host who books a stay elsewhere uses the same pages (isHost only adds the panel link).

export type AccountUser = {
  id: string;
  email: string | null;
  pendingEmail: string | null; // new address waiting for confirmation
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isHost: boolean;
  hasPassword: boolean; // email + password sign-in (not Google only)
  createdAt: string | null; // when the account was made (ISO)
  notify: NotifyPrefs;
};

export const getAccountUser = cache(async (): Promise<AccountUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const provider = user.app_metadata?.provider;
  const providers: string[] = user.app_metadata?.providers ?? (provider ? [provider] : []);
  const guest = meta.account_type === "guest" || provider === "google" || provider === "apple";
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    id: user.id,
    email: user.email ?? null,
    pendingEmail: user.new_email ?? null,
    name: text(meta.full_name) ?? text(meta.name),
    phone: text(meta.phone),
    avatarUrl: avatarOf(meta),
    isHost: !guest,
    hasPassword: providers.includes("email"),
    createdAt: user.created_at ?? null,
    notify: readNotifyPrefs(meta.notify),
  };
});

// For pages: the user, or the login page with a way back.
export async function requireAccountUser(next: string): Promise<AccountUser> {
  const user = await getAccountUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

// True when a table / function of a migration not yet applied is missing (PostgREST schema cache):
// the page shows an empty or "coming soon" state instead of a load error.
export function notDeployed(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "PGRST202";
}
