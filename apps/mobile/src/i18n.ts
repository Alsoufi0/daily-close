import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { normalizeLanguage, translate, type Language } from "@smokeshop/shared/i18n";

const LANGUAGE_KEY = "dailyclose:language";

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

/**
 * Switch the app language and persist it. This is the function every language
 * picker should call.
 *
 * React Native applies right-to-left *layout* (mirrored menus, sliders) only at
 * launch, via I18nManager.forceRTL. Flipping it mid-session does nothing until
 * the next cold start — which is why switching Arabic→English used to leave the
 * drawer and store slider stuck RTL until the user fully closed the app.
 *
 * So: when a switch crosses the RTL boundary (into or out of Arabic) we persist
 * the choice, set the new direction, and reload the JS bundle so it relaunches
 * with the correct layout. Switches that stay LTR (en/es/hi) need no reload —
 * the live remount handles them instantly.
 */
export async function changeLanguage(lang: Language) {
  if (lang === currentLanguage) return;
  await AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(() => {});

  const willBeRTL = lang === "ar";
  if (willBeRTL !== I18nManager.isRTL) {
    currentLanguage = lang;
    I18nManager.allowRTL(willBeRTL);
    I18nManager.forceRTL(willBeRTL);
    try {
      // Relaunch so the mirrored layout direction takes effect cleanly.
      await Updates.reloadAsync();
      return;
    } catch {
      // reloadAsync is unavailable (e.g. a dev client without updates) — fall
      // back to the live remount. Layout direction will catch up on next launch.
    }
  }
  setMobileLanguage(lang);
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
