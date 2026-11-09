"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { FormMessage, Spinner, inputClass, saveButton, secondaryButton } from "./ui";

export type ReviewValue = { id: string; rating: number; comment: string } | null;

// Write, edit or delete the review of one finished stay. RLS lets only the author of the booking
// write it, and only after check-out (0016_guest_profile.sql).
export function ReviewForm({ bookingId, unitId, review }: { bookingId: string; unitId: string; review: ReviewValue }) {
  const t = useTranslations("Account.reviews");
  const router = useRouter();
  const [editing, setEditing] = useState(!review);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [busy, setBusy] = useState<null | "save" | "delete">(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return setMsg({ kind: "error", text: t("errors.rating") });
    setBusy("save");
    setMsg(null);
    const supabase = createClient();
    const body = { rating, comment: comment.trim() };
    const { error } = review
      ? await supabase.from("reviews").update(body).eq("id", review.id)
      : await supabase.from("reviews").insert({ ...body, booking_id: bookingId, unit_id: unitId });
    setBusy(null);
    if (error) return setMsg({ kind: "error", text: t("errors.generic") });
    setEditing(false);
    router.refresh();
  };

  const remove = async () => {
    if (!review) return;
    setBusy("delete");
    const { error } = await createClient().from("reviews").delete().eq("id", review.id);
    setBusy(null);
    if (error) return setMsg({ kind: "error", text: t("errors.generic") });
    router.refresh();
  };

  if (review && !editing) {
    return (
      <div>
        <Stars value={review.rating} />
        {review.comment && <p className="mt-2 max-w-prose text-sm whitespace-pre-line text-ink">{review.comment}</p>}
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
            <Pencil className="size-4" />
            {t("edit")}
          </button>
          <button type="button" disabled={!!busy} onClick={remove} className={secondaryButton}>
            <Spinner on={busy === "delete"}>
              <Trash2 className="size-4" />
            </Spinner>
            {t("delete")}
          </button>
        </div>
        <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate>
      <div role="radiogroup" aria-label={t("rating")} className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("stars", { count: n })}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-full p-1 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Star className={`size-7 ${(hover || rating) >= n ? "fill-star text-star" : "text-sand-200"}`} />
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-ink">{t("comment")}</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("placeholder")}
          className={`${inputClass} resize-y`}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button type="submit" disabled={!!busy} className={saveButton}>
          <Spinner on={busy === "save"}>{null}</Spinner>
          {review ? t("update") : t("submit")}
        </button>
        {review && (
          <button type="button" onClick={() => setEditing(false)} className={secondaryButton}>
            {t("cancel")}
          </button>
        )}
      </div>
      <FormMessage kind={msg?.kind ?? null} text={msg?.text ?? null} />
    </form>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-5 ${value >= n ? "fill-star text-star" : "text-sand-200"}`} aria-hidden />
      ))}
    </span>
  );
}
