import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeLanguage, translate, type Language } from "@smokeshop/shared/i18n";

const LANGUAGE_KEY = "dailyclose:language";

// Keep the NATIVE layout LTR-based and mirror direction ourselves in JS (see
// isRTL()). React Native's I18nManager.forceRTL only applies at a cold start,
// so the old code had to reload the whole app when switching to/from Arabic —
// which dumped the user out of whatever store/screen they were on. Driving the
// menu side and alignment from isRTL() flips things live, in place, no restart.
I18nManager.allowRTL(false);

let currentLanguage: Language = normalizeLanguage(undefined);
let listeners: Array<() => void> = [];

export function setMobileLanguage(lang: Language) {
  currentLanguage = lang;
  // Notify subscribers (the App root) so the whole tree re-renders in the new
  // language. t() reads this module variable, not React state, so without this
  // nothing updates until a restart.
  listeners.forEach((l) => l());
}

/**
 * Switch the app language and persist it. Applies instantly and live: the App
 * root re-renders in place via onLanguageChange, so the user keeps their
 * current screen. Arabic layout direction is handled in JS (isRTL()), so no
 * app reload is ever needed.
 */
export async function changeLanguage(lang: Language) {
  if (lang === currentLanguage) return;
  // Apply FIRST, synchronously (before any await) so the UI flips on the first
  // tap. The previous order awaited AsyncStorage before applying, which made
  // the picker feel one tap behind (you'd tap Spanish and it stayed English
  // until the next tap). Persisting can happen after; the language is live.
  setMobileLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(() => {});
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

/** True for right-to-left languages (Arabic). Drives JS-level layout mirroring. */
export function isRTL() {
  return currentLanguage === "ar";
}

export function t(key: string) {
  return translate(currentLanguage, key);
}
