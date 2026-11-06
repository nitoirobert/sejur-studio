import { useEffect, useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/*
  Efect de „mașină de scris": scrie un cuvânt literă cu literă, așteaptă, îl șterge, trece la următorul.
  Întoarce null când efectul e oprit (pe server, când e pus pe pauză sau dacă utilizatorul
  a cerut „mișcare redusă" în sistem) – atunci afișăm un text fix.
*/
export function useTypewriter(words: readonly string[], paused: boolean): string | null {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
  const [s, setS] = useState({ i: 0, len: 0, deleting: false });
  const running = !paused && !reduced && words.length > 0;

  useEffect(() => {
    if (!running) return;
    const word = words[s.i % words.length];
    let delay: number;
    let next: typeof s;
    if (!s.deleting && s.len < word.length) {
      delay = 55 + Math.random() * 60; // ritm natural de tastare
      next = { ...s, len: s.len + 1 };
    } else if (!s.deleting) {
      delay = 1600;
      next = { ...s, deleting: true };
    } else if (s.len > 0) {
      delay = 28;
      next = { ...s, len: s.len - 1 };
    } else {
      delay = 350;
      next = { i: s.i + 1, len: 0, deleting: false };
    }
    const id = setTimeout(() => setS(next), delay);
    return () => clearTimeout(id);
  }, [s, running, words]);

  if (!running) return null;
  return words[s.i % words.length].slice(0, s.len);
}
