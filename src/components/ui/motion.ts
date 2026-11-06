import type { Transition, Variants } from "motion/react";

// Setări de animație comune, ca tot site-ul să se miște la fel.

// Arc moale – pentru panouri, carduri, butoane
export const spring: Transition = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 220, damping: 28 };

// Popover-uri (perioadă, oaspeți, locație, sugestii): apar din locul de unde au fost deschise
export const popover: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.97, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: spring },
  exit: { opacity: 0, y: -4, scale: 0.98, filter: "blur(2px)", transition: { duration: 0.12 } },
};

// Fundalul întunecat din spatele panourilor/modalelor
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// Listă cu elemente care intră pe rând
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};

// Intrare caldă: fără „arc" (nu sare), doar o alunecare lină cu încetinire la final.
// `custom` = poziția cardului în listă → intră pe rând (maxim ~0,4 s întârziere).
export const rise: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 14) * 0.03 },
  }),
};
