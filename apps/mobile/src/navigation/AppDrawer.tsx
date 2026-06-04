import { createDrawerNavigator } from "@react-navigation/drawer";
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OwnerScreen } from "../screens/OwnerScreen";
import { EmployeeScreen } from "../screens/EmployeeScreen";
import { AllStoresScreen } from "../screens/AllStoresScreen";
import { AdminStoresScreen } from "../screens/admin/AdminStoresScreen";
import { AdminEmployeesScreen } from "../screens/admin/AdminEmployeesScreen";
import { ReportsScreen } from "../screens/ReportsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ChangePasswordScreen } from "../screens/settings/ChangePasswordScreen";
import { WhatsAppSettingsScreen } from "../screens/settings/WhatsAppSettingsScreen";
import { PhoneSignInScreen } from "../screens/settings/PhoneSignInScreen";
import { LanguageScreen } from "../screens/settings/LanguageScreen";
import { getMobileLanguage, t } from "../i18n";
import { colors, font, radius, spacing } from "../theme";

export type DrawerParamList = {
  Dashboard: undefined;
  CloseStore: undefined;
  AllStores: undefined;
  AdminStores: undefined;
  AdminEmployees: undefined;
  Reports: undefined;
  SettingsRoot: undefined; // stack so Settings can drill into Password/WhatsApp/Language
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  ChangePassword: undefined;
  WhatsAppSettings: undefined;
  PhoneSignIn: undefined;
  Language: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: font.black, fontSize: 16 }
      }}
    >
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: t("account.changePassword") }} />
      <SettingsStack.Screen name="WhatsAppSettings" component={WhatsAppSettingsScreen} options={{ title: t("settings.whatsappTitle") }} />
      <SettingsStack.Screen name="PhoneSignIn" component={PhoneSignInScreen} options={{ title: t("phoneSignin.title") }} />
      <SettingsStack.Screen name="Language" component={LanguageScreen} options={{ title: t("common.language") }} />
    </SettingsStack.Navigator>
  );
}

export function AppDrawer({ onSignOut }: { onSignOut: () => Promise<void> | void }) {
  // Re-key on language so React Navigation re-reads the screen options
  // (which are evaluated at register time, not on each render). Without
  // this, switching language doesn't update drawer labels until app restart.
  const langKey = getMobileLanguage();

  function confirmSignOut() {
    Alert.alert(
      t("auth.signOutTitle"),
      t("auth.signOutBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("auth.signOut"), style: "destructive", onPress: () => onSignOut() }
      ]
    );
  }

  return (
    <Drawer.Navigator
      key={langKey}
      initialRouteName="Dashboard"
      screenOptions={{
        headerStyle: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: font.black, fontSize: 18 },
        drawerActiveTintColor: colors.leaf,
        drawerInactiveTintColor: colors.ink,
        drawerActiveBackgroundColor: colors.leafSoft,
        drawerLabelStyle: { fontWeight: font.black, fontSize: 14, marginLeft: -16 }
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} onSignOut={confirmSignOut} />}
    >
      <Drawer.Screen
        name="Dashboard"
        options={{ title: t("dashboard.title"), drawerLabel: `🏠  ${t("nav.dashboard")}` }}
      >
        {() => <OwnerScreen onSignOut={onSignOut} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="CloseStore"
        options={{ title: t("nav.closeStore"), drawerLabel: `🧾  ${t("nav.closeStore")}` }}
      >
        {() => <EmployeeScreen onSignOut={onSignOut} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="AllStores"
        component={AllStoresScreen}
        options={{ title: t("nav.allStores"), drawerLabel: `🏪  ${t("nav.allStores")}` }}
      />

      <Drawer.Screen
        name="AdminStores"
        component={AdminStoresScreen}
        options={{ title: t("nav.adminStores"), drawerLabel: `🏬  ${t("nav.adminStores")}` }}
      />

      <Drawer.Screen
        name="AdminEmployees"
        component={AdminEmployeesScreen}
        options={{ title: t("nav.adminEmployees"), drawerLabel: `👥  ${t("nav.adminEmployees")}` }}
      />

      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: t("nav.reports"), drawerLabel: `📊  ${t("nav.reports")}` }}
      />

      <Drawer.Screen
        name="SettingsRoot"
        component={SettingsStackScreen}
        options={{ title: t("nav.settings"), drawerLabel: `⚙️  ${t("nav.settings")}` }}
      />
    </Drawer.Navigator>
  );
}

function CustomDrawerContent({
  onSignOut,
  ...rest
}: DrawerContentComponentProps & { onSignOut: () => void }) {
  return (
    <DrawerContentScrollView {...rest} contentContainerStyle={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Daily Close</Text>
        <Text style={s.headerSubtitle}>{t("nav.mobile")}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <DrawerItemList {...rest} />
      </View>
      <TouchableOpacity onPress={onSignOut} style={s.signOutBtn}>
        <Text style={s.signOutText}>{t("auth.signOut")}</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm
  },
  headerTitle: { color: colors.leaf, fontWeight: font.black, fontSize: 22, letterSpacing: -0.3 },
  headerSubtitle: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  signOutBtn: {
    margin: spacing.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.md,
    alignItems: "center"
  },
  signOutText: { color: colors.ink, fontWeight: font.black, fontSize: 14 }
});
