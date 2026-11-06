import { getRequestConfig } from "next-intl/server";

// Deocamdată avem o singură limbă (ro). Când adăugăm "en",
// aici citim limba din URL sau din cookie.
export const defaultLocale = "ro";

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    timeZone: "Europe/Bucharest",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
