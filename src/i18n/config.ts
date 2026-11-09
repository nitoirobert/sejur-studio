// Limbile site-ului. Română e implicită; restul sunt limbile internaționale principale.
export const locales = ["ro", "en", "de", "fr", "es", "it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ro";
export const localeCookie = "NEXT_LOCALE";

// Numele fiecărei limbi în limba ei (așa o recunoaște cine o vorbește)
export const localeNames: Record<Locale, string> = {
  ro: "Română",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// Alege limba din antetul Accept-Language (ex. "de-DE,de;q=0.9,en;q=0.8")
export function matchLocale(header: string | null): Locale {
  if (!header) return defaultLocale;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return wanted.find((w) => isLocale(w.lang))?.lang as Locale | undefined ?? defaultLocale;
}
