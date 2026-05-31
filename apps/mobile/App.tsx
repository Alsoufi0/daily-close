import { useEffect, useState } from "react";
import { AppState, AppStateStatus, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OwnerScreen } from "./src/screens/OwnerScreen";
import { EmployeeScreen } from "./src/screens/EmployeeScreen";
import { colors } from "./src/theme";
import { clearToken, registerOutboxHandlers } from "./src/api";
import { drainOnce } from "./src/outbox";
import { supabase } from "./src/supabase";

type Screen = "login" | "owner" | "employee";

// Mobile crash reporting — mirrors the web/API Sentry setup. Initialised at
// module load (before any screen renders) so even crashes in render paths get
// captured. EXPO_PUBLIC_SENTRY_DSN is baked at build time by EAS; without it
// Sentry is silently a no-op so dev / Expo Go runs don't error out.
//
// EAS source map upload needs SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT
// as EAS secrets at build time. The @sentry/react-native/expo plugin (added
// in app.json) takes care of wiring the native SDK on iOS + Android.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENV || "production",
    // Performance traces — keep low until we have a real volume baseline so the
    // free Sentry tier (50k events/month) isn't blown by an idle dashboard poll.
    tracesSampleRate: 0.05,
    enableAutoSessionTracking: true,
    // Auto-attach the release tag from app.json's version so dashboard groups
    // crashes by app version (helps spot "1.0.3 regressed compared to 1.0.2").
    sendDefaultPii: false
  });
}

// One-time wiring at module load so the outbox queue can drain even before
// any screen mounts (e.g. user opens the app while offline and the queue
// has pending closes from yesterday).
registerOutboxHandlers();

function App() {
  const [screen, setScreen] = useState<Screen>("login");

  // Drain the outbox on app start and every time the app comes back to
  // the foreground (audit fix #5 phase 2). Network checks happen at the
  // handler level — drainOnce is a no-op if nothing's ready. Phase 3
  // adds NetInfo-driven drains on actual network state changes.
  useEffect(() => {
    drainOnce().catch(() => {});
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        drainOnce().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  async function signOut() {
    try {
      await clearToken();
      if (supabase) await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    setScreen("login");
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        {screen === "login" ? <LoginScreen onOpen={setScreen} /> : null}
        {screen === "owner" ? <OwnerScreen onSignOut={signOut} /> : null}
        {screen === "employee" ? <EmployeeScreen onSignOut={signOut} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }
});

// Re-export App wrapped in Sentry's error boundary + perf integration when
// the DSN is set. Without DSN it returns App unwrapped so dev/Expo Go runs
// don't pull the SDK's runtime overhead.
export default SENTRY_DSN ? Sentry.wrap(App) : App;
