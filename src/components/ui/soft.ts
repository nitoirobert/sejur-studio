// Clase reutilizabile pentru stilul „soft UI".
// Le ținem într-un singur loc ca toate ecranele să arate la fel.
// Tranziția CSS nu include „transform", ca să nu se bată cu animațiile din biblioteca motion.

export const card = "bg-cream-50 rounded-card shadow-soft";

export const pill =
  "inline-flex items-center gap-2 rounded-full bg-cream-50 shadow-pill text-sm font-medium text-ink transition-[color,background-color,box-shadow,translate] duration-200 hover:-translate-y-px hover:shadow-soft active:translate-y-0 active:shadow-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const pillActive =
  "inline-flex items-center gap-2 rounded-full bg-accent text-cream-50 shadow-accent text-sm font-semibold transition-[color,background-color,box-shadow,translate] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const iconButton =
  "grid size-10 shrink-0 place-items-center rounded-full bg-cream-50 text-ink shadow-pill transition-[color,background-color,box-shadow,translate] duration-200 hover:-translate-y-px active:translate-y-0 active:shadow-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-cream-50 shadow-accent transition-[color,background-color,box-shadow,translate] duration-200 hover:bg-accent-600 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const sectionTitle = "font-serif text-xl text-ink";
