"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  "Daily Close": "brand.name",
  "Daily closing, done in minutes.": "home.mobileHero",
  "Daily closing for your store, done in 2 minutes.": "home.hero",
  "Multi-store · iOS · Android · Web": "home.platforms",
  "Stop chasing paper sheets and late-night phone calls. Your employees close from their phone, you see the truth — and your accountant gets clean numbers.": "home.value",
  "$29 per store / month · 14 days free · cancel anytime": "home.price",
  "Close in 2 minutes": "home.featureCloseTitle",
  "Employees upload the POS report, count cash, and submit — straight from their phone.": "home.featureCloseBody",
  "Owner sees everything": "home.featureOwnerTitle",
  "Today's sales, which stores closed, and any cash that's missing — in one glance.": "home.featureOwnerBody",
  "Built for accountants": "home.featureBooksTitle",
  "Secure auth, full audit trail, CSV export, missed-close alerts — ready for your books.": "home.featureBooksBody",
  "iOS & Android apps": "home.mobileApps",
  "Same login, same data — built with Expo for store submission.": "home.mobileAppsBody",
  "Hide password": "auth.hidePassword",
  "Show password": "auth.showPassword",
  "Signing in...": "auth.signingIn",
  "Your session expired. Please sign in again.": "auth.sessionExpired",
  "Supabase not configured — opening demo mode.": "auth.demoFallback",
  "Login failed. Check your email and password.": "auth.loginFailed",
  "Demo": "nav.demo",
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
  "Last updated: 2026-05-22": "legal.lastUpdated",
  "Daily Close stores account, store, employee, daily close, expense, report image, and notification information for the sole purpose of running the closing workflow.": "legal.privacyIntro",
  "What we collect:": "legal.whatCollect",
  "name, email, password (hashed by Supabase Auth), store details you create, daily close numbers, POS report images you upload.": "legal.collectBody",
  "Who sees it:": "legal.whoSees",
  "store owners can see their own stores and the employees they invite. Employees can only see the store they are assigned to. No data is shared with third parties.": "legal.whoSeesBody",
  "Where it lives:": "legal.whereLives",
  "Supabase Postgres + Storage. Backups are managed by Supabase. POS report images are kept for the lifetime of the corresponding daily close record.": "legal.whereLivesBody",
  "Delete my data:": "legal.deleteData",
  "and we will remove your account and all related records within 30 days.": "legal.deleteDataBody",
  "Daily Close is a subscription service for retail owners and their employees to submit and review daily closing records.": "legal.termsIntro",
  "Your data.": "legal.yourData",
  "Store owners are responsible for the accuracy of the numbers their employees submit and for resolving any cash differences identified by the application.": "legal.yourDataBody",
  "Subscription.": "legal.subscription",
  "Billing is $29 USD per store per month, charged in advance, after a 14-day free trial. You can cancel at any time from the Billing page. Refunds are at our discretion for partial months.": "legal.subscriptionBody",
  "Image processing.": "legal.imageProcessing",
  "Uploaded POS report images are stored securely and used to assist data entry. We do not share them with third parties.": "legal.imageProcessingBody",
  "Liability.": "legal.liability",
  "Daily Close is provided \"as is.\" We make no warranty that the service will be uninterrupted or error-free. Our maximum aggregate liability is limited to the fees paid in the prior 12 months.": "legal.liabilityBody",
  "For support, contact": "legal.supportContact",
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
  "Store closed alerts": "settings.closeAlerts",
  "Weekly and monthly reports": "settings.weeklyMonthlyReports",
  "Send test WhatsApp": "settings.sendTest",
  "Add locations and set the close time for each one.": "admin.storesHelp",
  "Saving...": "admin.saving",
  "Edit store": "admin.editStore",
  "Remove store": "admin.removeStore"
  ,"Every assigned store has reported in.": "dashboard.everyStoreReported",
  "Call the store or remind the employee.": "dashboard.callStore",
  "Counted cash matches expected for every store.": "dashboard.cashMatches",
  "Add your first store from the admin panel to start tracking closes.": "dashboard.noStoresBody",
  "Run more than one store?": "dashboard.runMoreStores",
  "Add your next store — multi-store totals, missed-close alerts, and one weekly summary email come included.": "dashboard.addNextStore",
  "Add store →": "dashboard.addStore",
  "Today's close hasn't been submitted yet": "dashboard.closeNotSubmitted",
  // === added 2026-05-27: hardcoded-string sweep ===
  "Invite the people who close your stores at night.": "admin.inviteEmployees",
  "Admin access": "admin.adminAccess",
  "First-run setup": "admin.firstRunSetup",
  "Change password": "auth.changePassword",
  "Use at least 8 characters.": "auth.atLeast8Chars",
  "At least 8 characters.": "auth.atLeast8CharsShort",
  "Something broke": "common.somethingBroke",
  "Sales": "common.sales",
  "Status": "common.status",
  "Subscription expired": "billing.expired",
  "Free trial": "billing.freeTrial",
  "Active": "billing.active",
  "Edit close": "history.editClose",
  "Delete close": "history.deleteClose",

  // === added 2026-05-27 (second sweep — /setup + /billing pages) ===
  "Done": "common.done",
  "Language": "common.language",
  // setup
  "Two quick steps to get your first store closing tonight.": "setup.subtitle",
  "Create your first store": "setup.createFirstStore",
  "Used to send a missed-close alert if no one submits by this time.": "setup.closeTimeHelp",
  "Creating…": "setup.creating",
  "Invite your first employee": "setup.inviteFirstEmployee",
  "They'll get an email with a sign-in link. You can do this later from the Employees page.": "setup.inviteHelp",
  "Skip for now": "setup.skipForNow",
  "Sending…": "setup.sending",
  "Send invite": "setup.sendInvite",
  "You're set up.": "setup.setupDone",
  "Open the owner dashboard to see tonight's close as it happens.": "setup.dashHelp",
  "Go to dashboard": "setup.goToDashboard",
  // billing
  "Your subscription": "billing.yourSubscription",
  "$29 per store, per month. Billed monthly. Cancel anytime.": "billing.tagline",
  "Trial ends today.": "billing.trialEndsToday",
  "Standard plan": "billing.standardPlan",
  "Employees finish closing from their phone.": "billing.featureCloseBody",
  "See sales, missing cash, alerts — all in one screen.": "billing.featureMultiBody",
  "Export every close for your accountant.": "billing.featureCsvBody",
  "Starting…": "billing.starting",
  "Manage billing": "billing.managePortal",
  "Could not start checkout.": "billing.checkoutFailed",
  "Close": "common.close",
  "This cannot be undone.": "common.cannotBeUndone"
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
  },
  // /setup hero: "Welcome." or "Welcome, {name}."
  {
    match: /^Welcome(?:,\s*(.+?))?\.$/,
    render: (match, lang) =>
      match[1]
        ? `${translate(lang, "setup.welcome")}, ${match[1]}.`
        : `${translate(lang, "setup.welcome")}.`
  },
  // /billing trial countdown: "1 day left in trial." / "12 days left in trial."
  {
    match: /^(\d+)\s+day\s+left\s+in\s+trial\.$/i,
    render: (match, lang) => `${match[1]} ${translate(lang, "billing.dayLeftInTrial")}`
  },
  {
    match: /^(\d+)\s+days\s+left\s+in\s+trial\.$/i,
    render: (match, lang) => `${match[1]} ${translate(lang, "billing.daysLeftInTrial")}`
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

  // setLang is stable across renders so consumer effects with [setLang] deps
  // don't re-fire. State change drives the actual re-render of every consumer
  // because `value` (below) is keyed on `lang`.
  const setLang = useCallback((next: Language) => {
    // Persist first, then hard-refresh so EVERY string re-resolves in the new
    // language. The in-place DOM translation pass doesn't reliably catch text
    // rendered once at mount (or by server components), so a reload is the
    // dependable way to apply a language switch everywhere. The provider
    // restores the persisted language on load.
    try {
      window.localStorage.setItem("dailyclose-lang", next);
    } catch {
      /* localStorage may be unavailable (Safari private mode) */
    }
    setLangState(next);
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  const value = useMemo(
    () => ({
      lang,
      dir: languageDir(lang),
      setLang,
      // Rebuilt every time `lang` changes, so consumers calling t() always
      // resolve against the current language — no stale closure.
      t: (key: string) => translate(lang, key)
    }),
    [lang, setLang]
  );

  // Persist + reflect lang to <html> attrs whenever lang changes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = languageDir(lang);
    try {
      window.localStorage.setItem("dailyclose-lang", lang);
    } catch {
      // localStorage may be unavailable (Safari private mode); ignore.
    }
    window.dispatchEvent(new CustomEvent("dailyclose:language-changed", { detail: lang }));
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
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT"].includes(parent.tagName)) {
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
