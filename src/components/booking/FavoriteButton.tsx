"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { iconButton } from "@/components/ui/soft";
import { AuthModal } from "@/components/browse/AuthModal";
import { toggleFavorite, useFavorites } from "@/lib/booking/favorites";

// The heart on /cazare/[id]: same store as the cards, so both show the same state.
// Without an account it opens the sign-in window.
export function FavoriteButton({ unitId, name }: { unitId: string; name: string }) {
  const t = useTranslations("Unit");
  const { ids } = useFavorites();
  const [auth, setAuth] = useState(false);
  const on = ids.has(unitId);

  return (
    <>
      <button
        type="button"
        onClick={() => void toggleFavorite(unitId).then((ok) => ok || setAuth(true))}
        aria-label={t("favorite", { name })}
        aria-pressed={on}
        className={`${iconButton} ${on ? "text-red-600" : ""} hover:text-red-600`}
      >
        <Heart className="size-4" fill={on ? "currentColor" : "none"} />
      </button>
      <AnimatePresence>{auth && <AuthModal key="auth" reason="favorite" onClose={() => setAuth(false)} />}</AnimatePresence>
    </>
  );
}
