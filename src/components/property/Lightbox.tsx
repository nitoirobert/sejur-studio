"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  photos: string[];
  name: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
};

// Galeria pe tot ecranul. Navigare: săgețile de pe ecran, click pe jumătatea stângă/dreaptă a pozei,
// tastele ← → (Esc închide) și glisare pe telefon. După ultima poză revine la prima.
export function Lightbox({ photos, name, index, onIndexChange, onClose }: Props) {
  const t = useTranslations("Gallery");
  const tDetail = useTranslations("Detail");
  const reduce = useReducedMotion();
  const [direction, setDirection] = useState(0); // -1 înapoi, 1 înainte: din ce parte intră poza nouă
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const total = photos.length;

  const go = useCallback(
    (step: number) => {
      setDirection(step);
      onIndexChange((index + step + total) % total);
    },
    [index, total, onIndexChange],
  );

  const jump = (i: number) => {
    if (i === index) return;
    setDirection(i > index ? 1 : -1);
    onIndexChange(i);
  };

  // Tastatură + blocarea derulării paginii din spate + focus pe „Închide" și înapoi la închidere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const slide = reduce ? 0 : 80;
  const control =
    "grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  // Fără portal: se poate afișa încă de pe server (link direct cu ?foto=n). Părintele nu are transform,
  // deci `fixed` acoperă tot ecranul.
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={t("label", { name })}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col bg-neutral-950 text-white"
    >
      {/* Sus: numărul pozei + închidere */}
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        <p className="truncate text-sm font-medium text-white/80">{name}</p>
        <p className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold tabular-nums" aria-live="polite">
          {t("counter", { index: index + 1, total })}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className={control} aria-label={t("close")}>
          <X className="size-5" />
        </button>
      </div>

      {/* Poza: click în jumătatea stângă = anterioara, în dreapta = următoarea */}
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * slide }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: -d * slide }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            drag={total > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            // onTap vine doar la click real (nu după o glisare), deci cele două gesturi nu se bat
            onTap={(e) => {
              if (total < 2 || !("clientX" in e)) return;
              const r = stageRef.current?.getBoundingClientRect();
              if (r) go(e.clientX - r.left < r.width / 2 ? -1 : 1);
            }}
            className={`absolute inset-0 touch-pan-y ${total > 1 ? "cursor-pointer" : ""}`}
          >
            <Image
              src={photos[index]}
              alt={tDetail("photo", { index: index + 1, total, name })}
              fill
              sizes="100vw"
              priority
              draggable={false}
              className="object-contain select-none"
            />
          </motion.div>
        </AnimatePresence>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className={`${control} absolute top-1/2 left-3 -translate-y-1/2 lg:left-6`}
              aria-label={t("prev")}
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className={`${control} absolute top-1/2 right-3 -translate-y-1/2 lg:right-6`}
              aria-label={t("next")}
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {/* Jos: miniaturile */}
      {total > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3 lg:px-6">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i)}
              aria-label={t("thumb", { index: i + 1 })}
              aria-current={i === index}
              className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition focus-visible:outline-2 focus-visible:outline-white ${
                i === index ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80"
              }`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
