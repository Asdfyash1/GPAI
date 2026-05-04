"use client";

import { t, type TKey } from "@/i18n";

export function useTranslation() {
  return { t: (key: TKey) => t(key) };
}
