"use client";

import { useEffect } from "react";
import { endTransition, useTheme } from "@/lib/theme";

/*
  Fundalul paginii, fix în spatele conținutului:
  - zi: plaja (public/bg.webp); noapte: plaja cu lună (public/bg-night.webp);
  - la schimbarea temei rulează videoul de tranziție (fără sunet, 8× mai rapid: 1,25 s).

  Cum evităm „clipirea":
  - sub video stă imaginea de DESTINAȚIE, afișată imediat – când videoul se termină, nu se schimbă nimic;
  - videoul are ca „poster" imaginea de plecare, deci primul cadru e exact fundalul de până atunci;
  - ultimul cadru al videoului e identic cu imaginea de destinație.
*/
const VIDEOS = ["/video/zi-noapte.mp4", "/video/noapte-zi.mp4"];

export function SceneBackground() {
  const { theme, transition } = useTheme();

  // Descărcăm videourile în fundal, când browserul e liber, ca să pornească imediat la click
  useEffect(() => {
    const warm = () => VIDEOS.forEach((src) => fetch(src, { priority: "low" } as RequestInit).catch(() => {}));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 2500);
    return () => clearTimeout(id);
  }, []);

  // Plasă de siguranță: dacă videoul se blochează (rețea lentă, tab în fundal), închidem tranziția oricum.
  // Imaginea de destinație e deja sub video, deci utilizatorul vede starea corectă.
  useEffect(() => {
    if (!transition) return;
    const id = setTimeout(endTransition, 3000);
    return () => clearTimeout(id);
  }, [transition]);

  const night = theme === "dark";
  const poster = transition?.kind === "toNight" ? "/bg.webp" : "/bg-night.webp";
  // fără animație de opacitate cât rulează videoul (imaginea de destinație apare instant, sub video)
  const fade = transition ? "0s" : undefined;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0d1626]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bg.webp"
        alt=""
        className="absolute inset-0 size-full object-cover transition-opacity duration-500"
        style={{ opacity: night ? 0 : 1, transitionDuration: fade }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bg-night.webp"
        alt=""
        className="absolute inset-0 size-full object-cover transition-opacity duration-500"
        style={{ opacity: night ? 1 : 0, transitionDuration: fade }}
      />
      {transition && (
        <video
          key={transition.id}
          src={transition.kind === "toNight" ? VIDEOS[0] : VIDEOS[1]}
          poster={poster}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={endTransition}
          onError={endTransition}
          // propriul strat pe GPU, ca să nu fie recompus odată cu restul paginii
          className="absolute inset-0 size-full transform-gpu object-cover will-change-transform"
        />
      )}
    </div>
  );
}
