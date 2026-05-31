import { useEffect, useState } from "react";
import { AppState, AppStateStatus, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";
import { LoginScreen } from "./src/screens/LoginScreen";
import { AppDrawer } from "./src/navigation/AppDrawer";
import { colors } from "./src/theme";
import { clearToken, registerOutboxHandlers } from "./src/api";
import { drainOnce } from "./src/outbox";
import { supabase } from "./src/supabase";

// Mobile crash reporting — mirrors the web/API Sentry setup. Initialised at
// module load (before any screen renders) so even crashes in render paths get
// captured. EXPO_PUBLIC_SENTRY_DSN is baked at build time by EAS; without it
// Sentry is silently a no-op so dev / Expo Go runs don't error out.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENV || "production",
    tracesSampleRate: 0.05,
    enableAutoSessionTracking: true,
    sendDefaultPii: false
  });
}

// One-time wiring at module load so the outbox queue can drain even before
// any screen mounts (e.g. user opens the app while offline and the queue
// has pending closes from yesterday).
registerOutboxHandlers();

type AuthState = "checking" | "out" | "in";

function App() {
  // Auth gate is a simple two-state machine (in / out). All the multi-screen
  // navigation happens INSIDE the "in" state via React Navigation's drawer.
  // "checking" is a brief boot frame so we don't flash the login screen
  // before reading the persisted Supabase session.
  const [authState, setAuthState] = useState<AuthState>(supabase ? "checking" : "out");

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthState(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthState(session ? "in" : "out");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Drain the outbox on app start and every time the app comes back to
  // the foreground. Network checks happen at the handler level — drainOnce
  // is a no-op if nothing's ready.
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
    setAuthState("out");
  }

  // While checking the persisted session we show nothing — under a few
  // hundred ms in practice. Could be a splash later if it ever feels long.
  if (authState === "checking") {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {authState === "out" ? (
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <LoginScreen onOpen={() => setAuthState("in")} />
        </SafeAreaView>
      ) : (
        // NavigationContainer owns its own safe-area handling. Don't wrap
        // it in SafeAreaView — that double-pads and clips drawer animations.
        <NavigationContainer>
          <AppDrawer onSignOut={signOut} />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }
});

export default SENTRY_DSN ? Sentry.wrap(App) : App;
