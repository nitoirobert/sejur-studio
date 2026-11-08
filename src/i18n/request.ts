import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookie, matchLocale } from "./config";

export { defaultLocale };

// Limba: cookie-ul ales de vizitator, altfel limba browserului, altfel română.
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(saved) ? saved : matchLocale((await headers()).get("accept-language"));
  const messages = (await import(`../../messages/${locale}.json`)).default;
  // Ce lipsește într-o limbă (ex. panoul proprietarului, Dashboard.*, scris deocamdată doar în română)
  // se afișează în română, nu ca eroare.
  const fallback = locale === defaultLocale ? null : (await import(`../../messages/${defaultLocale}.json`)).default;
  return {
    locale,
    timeZone: "Europe/Bucharest",
    messages: fallback ? withFallback(messages, fallback) : messages,
  };
});

type Messages = { [key: string]: string | Messages };

function withFallback(primary: Messages, fallback: Messages): Messages {
  const out: Messages = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    const base = out[key];
    out[key] =
      typeof value === "object" && typeof base === "object" ? withFallback(value, base) : value;
  }
  return out;
}
