import { en, zh_HK, type MessageKey, type MessageMap } from "./messages";
import type { AppLocale, LocalePreference } from "../shared/types";

const messages: Record<AppLocale, MessageMap> = {
  en,
  zh_HK
};

export function normalizeAppLocale(rawValue: string | undefined): AppLocale {
  const value = rawValue?.replace("_", "-").toLowerCase() ?? "";
  if (
    value === "zh" ||
    value === "zh-hk" ||
    value === "zh-mo" ||
    value === "zh-tw" ||
    value.startsWith("zh-hant")
  ) {
    return "zh_HK";
  }
  return "en";
}

export function normalizeLocalePreference(rawValue: unknown): LocalePreference {
  if (rawValue === "en" || rawValue === "zh_HK") {
    return rawValue;
  }
  return detectDefaultLocale();
}

export function detectDefaultLocale(): AppLocale {
  const chromeLanguage =
    typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : undefined;

  return normalizeAppLocale(chromeLanguage ?? navigator.language);
}

export function getEffectiveLocale(preference: LocalePreference | undefined): AppLocale {
  return preference ?? detectDefaultLocale();
}

export function t(locale: AppLocale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}

export type { AppLocale, LocalePreference, MessageKey };
