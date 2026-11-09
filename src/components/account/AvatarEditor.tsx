"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET, squareAvatar } from "@/lib/avatar";
import { FormMessage, secondaryButtonSm } from "./ui";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024; // the original photo; the upload itself is resized to ~20 KB

// Profile picture: upload (resized to a 256 px WebP square in the browser), change, remove.
export function AvatarEditor({ userId, initial, avatarUrl }: { userId: string; initial: string; avatarUrl: string | null }) {
  const t = useTranslations("Account.avatar");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [busy, setBusy] = useState<null | "upload" | "remove">(null);
  const [error, setError] = useState<null | "type" | "size" | "generic">(null);
  const path = `${userId}/avatar.webp`;
  const hasCustom = !!avatar && avatar.includes(`/${AVATAR_BUCKET}/`);

  const upload = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("type");
    if (file.size > MAX_SOURCE_BYTES) return setError("size");
    setBusy("upload");
    try {
      const supabase = createClient();
      const blob = await squareAvatar(file);
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`; // same path every time: bust the cache
      const { error: metaErr } = await supabase.auth.updateUser({ data: { custom_avatar_url: url } });
      if (metaErr) throw metaErr;
      setAvatar(url);
      router.refresh();
    } catch {
      setError("generic");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy("remove");
    try {
      const supabase = createClient();
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      const { data, error: metaErr } = await supabase.auth.updateUser({ data: { custom_avatar_url: null } });
      if (metaErr) throw metaErr;
      const meta = data.user?.user_metadata ?? {};
      setAvatar((meta.avatar_url || meta.picture || null) as string | null); // back to the Google picture, if any
      router.refresh();
    } catch {
      setError("generic");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={!!busy}
          aria-label={t("change")}
          className="group relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-2xl font-bold text-cream-50 shadow-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- external avatar URL (Supabase / Google)
            <img src={avatar} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initial
          )}
          <span
            className={`absolute inset-0 grid place-items-center bg-[#0b1220]/45 transition-opacity ${
              busy === "upload" ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            {busy === "upload" ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </span>
        </button>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={!!busy} onClick={() => fileInput.current?.click()} className={secondaryButtonSm}>
            <Camera className="size-4" />
            {avatar ? t("change") : t("add")}
          </button>
          {hasCustom && (
            <button type="button" disabled={!!busy} onClick={remove} className={secondaryButtonSm}>
              {busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t("remove")}
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow picking the same file again
          if (file) upload(file);
        }}
      />
      <FormMessage kind={error ? "error" : null} text={error ? t(`errors.${error}`) : null} />
    </div>
  );
}
