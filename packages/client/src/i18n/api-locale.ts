import { getInitialLocale, type Locale } from "@/i18n/locales";
import { pb } from "@/lib/pocketbase";

let currentLocale: Locale = getInitialLocale();

pb.lang = currentLocale;
pb.beforeSend = (url, options) => {
  const headers = new Headers(options.headers);
  headers.set("Accept-Language", currentLocale);
  headers.set("X-Renewlet-Locale", currentLocale);
  return { url, options: { ...options, headers: Object.fromEntries(headers.entries()) } };
};

export function getApiLocale(): Locale {
  return currentLocale;
}

export function setApiLocale(locale: Locale) {
  currentLocale = locale;
  pb.lang = locale;
}

export function getLocaleHeaders(): Record<string, string> {
  return {
    "Accept-Language": currentLocale,
    "X-Renewlet-Locale": currentLocale,
  };
}
