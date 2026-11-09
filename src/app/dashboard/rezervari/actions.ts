"use server";

import { refresh } from "next/cache";
import { getViewer, requireViewer } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { respondErrorCode, respondSchema, type RequestResult } from "@/components/dashboard/requests/codes";

// Confirm or decline a booking request (a hold from the public site). Session first (a guest
// account is sent back to the site), then a strict schema, then one RPC that checks the
// organization itself. On success, and when the row turned out to be gone or already answered,
// refresh() re-renders the page (list, badge total, chart) in the same response.
export async function respondToRequest(input: unknown): Promise<RequestResult> {
  await requireViewer();

  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "booking_not_found" };
  const { booking_id, decision } = parsed.data;

  try {
    const supabase = await createClient();
    const { error } =
      decision === "confirm"
        ? await supabase.rpc("confirm_booking", { p_booking_id: booking_id })
        : await supabase.rpc("decline_booking", { p_booking_id: booking_id });
    if (error) {
      const code = respondErrorCode(error);
      if (code === "generic") console.error(`${decision}_booking failed`, error.code ?? "no code");
      // The row is not a live request any more: show its real state.
      if (code === "booking_not_found" || code === "invalid_status") refresh();
      return { ok: false, code };
    }
    refresh();
    return { ok: true };
  } catch {
    console.error(`${decision}_booking threw`);
    return { ok: false, code: "generic" };
  }
}

// The sidebar badge: same predicate as the list total. Never redirects (it runs in the background);
// a guest or a signed-out browser gets 0, a failed call null (the badge keeps what it shows).
export async function loadPendingCount(): Promise<number | null> {
  const viewer = await getViewer();
  if (!viewer?.isHost) return 0;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("pending_requests_count");
    if (error || typeof data !== "number") return null;
    return data;
  } catch {
    return null;
  }
}
