import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import type { IsoDate } from "@/lib/dates/days";
import { PAGE_SIZE } from "./codes";
import { RequestsList, type PendingRequest } from "./RequestsList";

// One page of pending_requests as the signed-in owner (RLS + is_org_member in the function).
// The function never returns public_token, user_id, guest_id or organization_id.
export async function PendingRequests({ page }: { page: number }) {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pending_requests", {
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error("pending_requests failed");
  const raw = data ?? [];
  // Past the last page (requests answered meanwhile): back to the first one.
  if (raw.length === 0 && page > 1) redirect("/dashboard/rezervari");

  const total = Number(raw[0]?.total_count ?? 0);
  const rows: PendingRequest[] = raw.map((r) => ({
    id: r.booking_id,
    unitName: r.unit_name,
    propertyName: r.property_name,
    checkIn: r.check_in as IsoDate,
    checkOut: r.check_out as IsoDate,
    adults: r.adults,
    children: r.children,
    totalAmount: r.total_amount,
    currency: r.currency,
    holdExpiresAt: r.hold_expires_at,
    createdAt: r.created_at,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    guestPhone: r.guest_phone,
  }));
  return <RequestsList rows={rows} total={total} page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} />;
}
