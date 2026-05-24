"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { languageDir, languages, normalizeLanguage, translate, type Language } from "@smokeshop/shared/i18n";

interface LanguageContextValue {
  lang: Language;
  dir: "ltr" | "rtl";
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("dailyclose-lang");
    setLangState(normalizeLanguage(stored || navigator.language));
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    window.localStorage.setItem("dailyclose-lang", next);
  };

  const value = useMemo(
    () => ({
      lang,
      dir: languageDir(lang),
      setLang,
      t: (key: string) => translate(lang, key)
    }),
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = languageDir(lang);
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export function LanguageSelect() {
  const { lang, setLang, t } = useLanguage();
  return (
    <label className="flex items-center gap-2 text-xs font-black text-ink/60">
      <span>{t("common.language")}</span>
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Language)}
        className="focus-ring rounded-lg border border-ink/10 bg-white px-2 py-1 text-sm font-bold text-ink"
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
