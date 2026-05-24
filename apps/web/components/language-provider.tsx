"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { languageDir, languages, normalizeLanguage, translate, type Language } from "@smokeshop/shared/i18n";

interface LanguageContextValue {
  lang: Language;
  dir: "ltr" | "rtl";
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const phraseKeys: Record<string, string> = {
  "Sign in": "auth.signIn",
  "Sign Out": "auth.signOut",
  "Get started": "auth.getStarted",
  "Owner": "nav.owner",
  "Employee": "nav.employee",
  "Admin": "nav.admin",
  "Billing": "nav.billing",
  "Password": "nav.password",
  "WhatsApp": "nav.whatsapp",
  "Export": "common.export",
  "Cancel": "common.cancel",
  "Save": "common.save",
  "Delete": "common.delete",
  "Edit": "common.edit",
  "Refresh": "common.refresh",
  "Store": "common.store",
  "Cash": "common.cash",
  "Card": "common.card",
  "Loading...": "common.loading",
  "Loading subscription...": "common.loading",
  "Loading stores...": "common.loading",
  "Loading employees...": "common.loading",
  "Today's Sales": "dashboard.salesToday",
  "Stores Closed": "dashboard.storesClosed",
  "Missing Cash": "dashboard.missingCash",
  "Needs Attention": "dashboard.needsAttention",
  "Store Comparison": "dashboard.storeComparison",
  "History": "dashboard.history",
  "Total Sales": "dashboard.totalSales",
  "Shortages": "dashboard.shortages",
  "Closes": "dashboard.closes",
  "Closed": "dashboard.closed",
  "Short": "dashboard.short",
  "Over": "dashboard.over",
  "Pending": "dashboard.pending",
  "Open": "dashboard.open",
  "Needs Closing": "dashboard.needsClosing",
  "Upload POS Report": "closing.upload",
  "Check Sales Numbers": "closing.sales",
  "Count Cash": "closing.cash",
  "Add Expenses": "closing.expenses",
  "Finish Closing": "closing.finish",
  "Start Closing": "closing.start",
  "Cash Sales": "closing.cashSales",
  "Card Sales": "closing.cardSales",
  "Cash Counted": "closing.cashCounted",
  "Expected Cash": "closing.expectedCash",
  "Difference": "closing.difference",
  "Notes": "closing.notes",
  "Optional": "common.optional",
  "Upload Report": "closing.uploadReport",
  "Take Photo": "closing.takePhoto",
  "Preview": "closing.preview",
  "Back": "common.back",
  "Back to sign in": "auth.backToSignIn",
  "Forgot password?": "auth.forgotPassword",
  "Create account": "auth.createAccount",
  "Create account · 14-day free trial": "auth.createTrial",
  "Create my account": "auth.createMyAccount",
  "Creating account...": "auth.creatingAccount",
  "Owner or employee account": "auth.ownerEmployeeAccount",
  "Email": "auth.email",
  "New password": "auth.newPassword",
  "Confirm new password": "auth.confirmPassword",
  "Update password": "auth.updatePassword",
  "Password updated.": "auth.passwordUpdated",
  "Back to dashboard": "auth.backToDashboard",
  "Terms": "legal.terms",
  "Privacy": "legal.privacy",
  "Privacy Policy": "legal.privacyPolicy",
  "Terms of Service": "legal.termsOfService",
  "Stores": "admin.stores",
  "Employees": "admin.employees",
  "New store": "admin.newStore",
  "Store name": "admin.storeName",
  "Address (optional)": "admin.addressOptional",
  "Daily close time": "admin.dailyCloseTime",
  "Timezone": "admin.timezone",
  "Create store": "admin.createStore",
  "Save changes": "admin.saveChanges",
  "Employee name": "admin.employeeName",
  "Employee email": "admin.employeeEmail",
  "Remove": "common.delete",
  "Password reset": "admin.passwordReset",
  "Opening Stores...": "admin.openingStores",
  "No stores yet.": "admin.noStores",
  "No stores yet — add your first one.": "admin.noStoresAdd",
  "Daily close in 2 min": "billing.dailyClose2Min",
  "Multi-store dashboard": "billing.multiStoreDashboard",
  "Audit-ready CSV": "billing.auditReadyCsv",
  "Choose plan": "billing.choosePlan",
  "Start paid plan": "billing.startPaidPlan",
  "Update payment": "billing.updatePayment",
  "Questions?": "billing.questions",
  "WhatsApp reports": "settings.whatsappTitle",
  "WhatsApp phone number": "settings.whatsappPhone",
  "Missed close alerts": "settings.missedAlerts",
  "Weekly and monthly reports": "settings.weeklyMonthlyReports"
  ,"Every assigned store has reported in.": "dashboard.everyStoreReported",
  "Call the store or remind the employee.": "dashboard.callStore",
  "Counted cash matches expected for every store.": "dashboard.cashMatches",
  "Add your first store from the admin panel to start tracking closes.": "dashboard.noStoresBody",
  "Run more than one store?": "dashboard.runMoreStores",
  "Add your next store — multi-store totals, missed-close alerts, and one weekly summary email come included.": "dashboard.addNextStore",
  "Add store →": "dashboard.addStore",
  "Today's close hasn't been submitted yet": "dashboard.closeNotSubmitted"
};

const dynamicPhraseRules: Array<{
  match: RegExp;
  render: (match: RegExpMatchArray, lang: Language) => string;
}> = [
  {
    match: /^Open\s*[·-]\s*closes\s+(.+)$/i,
    render: (match, lang) => `${translate(lang, "dashboard.open")} · ${translate(lang, "dashboard.closesAt")} ${match[1]}`
  },
  {
    match: /^Cash difference:\s*(.+)$/i,
    render: (match, lang) => `${translate(lang, "dashboard.cashDifference")}: ${match[1]}`
  },
  {
    match: /^Today's close due at\s+(.+)$/i,
    render: (match, lang) => `${translate(lang, "dashboard.closeDueAt")} ${match[1]}`
  },
  {
    match: /^(.+)\s+is short\s+(.+)$/i,
    render: (match, lang) => `${match[1]} ${translate(lang, "dashboard.isShort")} ${match[2]}`
  }
];

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");
  const originalText = useRef(new WeakMap<Text, string>());
  const originalAttrs = useRef(new WeakMap<Element, Record<string, string>>());

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

  useEffect(() => {
    if (typeof document === "undefined") return;
    const translateNow = () => localizeDom(document.body, lang, originalText.current, originalAttrs.current);
    translateNow();
    const observer = new MutationObserver(() => translateNow());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"]
    });
    return () => observer.disconnect();
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function localizeDom(
  root: HTMLElement,
  lang: Language,
  originalText: WeakMap<Text, string>,
  originalAttrs: WeakMap<Element, Record<string, string>>
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      const text = node.textContent?.trim() || "";
      if (!text || /^\$?[\d,.:/\-\s]+$/.test(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const original = originalText.get(node) || node.textContent || "";
    if (!originalText.has(node)) originalText.set(node, original);
    const next = translatePhrase(original, lang);
    if (next !== node.textContent) node.textContent = next;
  });

  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => {
    const stored = originalAttrs.get(el) || {};
    ["placeholder", "aria-label", "title"].forEach((attr) => {
      const current = el.getAttribute(attr);
      if (!current) return;
      const original = stored[attr] || current;
      stored[attr] = original;
      const next = translatePhrase(original, lang);
      if (next !== current) el.setAttribute(attr, next);
    });
    originalAttrs.set(el, stored);
  });
}

function translatePhrase(value: string, lang: Language): string {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const compact = value.trim().replace(/\u2026/g, "...").replace(/\s+/g, " ");
  const key = phraseKeys[compact];
  if (key) return `${leading}${translate(lang, key)}${trailing}`;
  for (const rule of dynamicPhraseRules) {
    const match = compact.match(rule.match);
    if (match) return `${leading}${rule.render(match, lang)}${trailing}`;
  }
  return value;
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
