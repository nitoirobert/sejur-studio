// Notification preferences of an account, kept in auth user_metadata.notify.
// Emails go out through Resend (decision 12) once brief 08 lands; the sender must read these.
// "booking" covers the messages a stay needs (request received, confirmed, cancelled): always on.

export const NOTIFY_KEYS = ["reminders", "reviews", "favorites", "offers"] as const;
export type NotifyKey = (typeof NOTIFY_KEYS)[number];
export type NotifyPrefs = Record<NotifyKey, boolean>;

export const DEFAULT_NOTIFY: NotifyPrefs = {
  reminders: true, // before arrival: address, check-in time
  reviews: true, // after the stay: ask for a review
  favorites: false, // a favourite stay gets a lower price or free dates
  offers: false, // newsletter / offers: opt-in only (GDPR)
};

export function readNotifyPrefs(raw: unknown): NotifyPrefs {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_NOTIFY };
  for (const k of NOTIFY_KEYS) if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  return out;
}
