import en, { type TranslationKeys } from "./en";

export type Locale = "en";

const translations: Record<Locale, TranslationKeys> = { en };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

type NestedKeyOf<T> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type TKey = NestedKeyOf<TranslationKeys>;

export function t(key: TKey): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = translations[currentLocale];
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === "string" ? value : key;
}

export { type TranslationKeys };
