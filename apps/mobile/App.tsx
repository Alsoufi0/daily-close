import { useEffect, useState } from "react";
import { AppState, AppStateStatus, SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OwnerScreen } from "./src/screens/OwnerScreen";
import { EmployeeScreen } from "./src/screens/EmployeeScreen";
import { colors } from "./src/theme";
import { clearToken, registerOutboxHandlers } from "./src/api";
import { drainOnce } from "./src/outbox";
import { supabase } from "./src/supabase";

type Screen = "login" | "owner" | "employee";

// One-time wiring at module load so the outbox queue can drain even before
// any screen mounts (e.g. user opens the app while offline and the queue
// has pending closes from yesterday).
registerOutboxHandlers();

export default function App() {
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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === "login" ? <LoginScreen onOpen={setScreen} /> : null}
      {screen === "owner" ? <OwnerScreen onBack={signOut} /> : null}
      {screen === "employee" ? <EmployeeScreen onBack={signOut} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }
});
