"use client";

import { useCallback, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { respondToRequest } from "@/app/dashboard/rezervari/actions";
import { usePendingBadge } from "./badge";
import type { Decision, RequestResult } from "./codes";

/*
  Confirm / decline in one transition. onStart runs inside it (an optimistic state set there lives
  until the action's refresh() has re-rendered the page). The badge drops by one at once and goes
  back if nothing reached the database; otherwise it reloads the real number.
*/
export function useRespond() {
  const [busy, startTransition] = useTransition();
  const badge = usePendingBadge();

  const respond = useCallback(
    (bookingId: string, decision: Decision, onStart?: () => void) =>
      new Promise<RequestResult>((resolve) => {
        startTransition(async () => {
          onStart?.();
          badge?.shift(-1);
          let result: RequestResult;
          try {
            result = await respondToRequest({ booking_id: bookingId, decision });
          } catch (e) {
            // redirect() from the action (session gone, guest account) must reach Next.
            unstable_rethrow(e);
            result = { ok: false, code: "generic" };
          }
          if (!result.ok && (result.code === "generic" || result.code === "unauthorized")) badge?.shift(1);
          else badge?.reload();
          resolve(result);
        });
      }),
    [badge],
  );

  return { respond, busy };
}
