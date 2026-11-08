import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookie, matchLocale } from "./config";

export { defaultLocale };

// Limba: cookie-ul ales de vizitator, altfel limba browserului, altfel română.
export default getRequestConfig(async () => {
  const saved = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(saved) ? saved : matchLocale((await headers()).get("accept-language"));
  return {
    locale,
    timeZone: "Europe/Bucharest",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
