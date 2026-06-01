import { I18nManager } from "react-native";
import { normalizeLanguage, translate, type Language } from "@dailyclose/shared/i18n";

let currentLanguage: Language = normalizeLanguage(undefined);

export function setMobileLanguage(lang: Language) {
  currentLanguage = lang;
  I18nManager.allowRTL(lang === "ar");
  I18nManager.forceRTL(lang === "ar");
}

export function getMobileLanguage() {
  return currentLanguage;
}

export function t(key: string) {
  return translate(currentLanguage, key);
}
