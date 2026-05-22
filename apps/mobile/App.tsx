import { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { OwnerScreen } from "./src/screens/OwnerScreen";
import { EmployeeScreen } from "./src/screens/EmployeeScreen";
import { colors } from "./src/theme";
import { clearToken } from "./src/api";
import { supabase } from "./src/supabase";

type Screen = "login" | "owner" | "employee";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");

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
