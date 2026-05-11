import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "pt" | "en")) {
    locale = routing.defaultLocale;
  }

  const messages =
    locale === "en"
      ? (await import("../../messages/en.json")).default
      : (await import("../../messages/pt.json")).default;

  return {
    locale,
    messages,
  };
});
