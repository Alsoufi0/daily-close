import { I18nManager } from "react-native";
import { normalizeLanguage, translate, type Language } from "@smokeshop/shared/i18n";

let currentLanguage: Language = normalizeLanguage(undefined);
let listeners: Array<() => void> = [];

export function setMobileLanguage(lang: Language) {
  currentLanguage = lang;
  I18nManager.allowRTL(lang === "ar");
  I18nManager.forceRTL(lang === "ar");
  // Notify subscribers so the UI can re-render in the new language. t() reads a
  // module variable (not React state), so without this nothing updates until an
  // app restart — which is exactly the bug this fixes.
  listeners.forEach((l) => l());
}

export function onLanguageChange(cb: () => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getMobileLanguage() {
  return currentLanguage;
}

export function t(key: string) {
  return translate(currentLanguage, key);
}
