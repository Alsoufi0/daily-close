import { createDrawerNavigator } from "@react-navigation/drawer";
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
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
import { isRTL, t } from "../i18n";
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
  // Direction is driven in JS (no native forceRTL / no app restart). The menu
  // sits on the right for Arabic, left otherwise. We key the navigator on
  // direction ONLY: en/es/hi switches re-render in place (labels update via the
  // function-form drawerLabel below, so the user keeps their screen), and only
  // crossing the Arabic boundary remounts to flip the drawer side.
  const rtl = isRTL();

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
      key={rtl ? "rtl" : "ltr"}
      initialRouteName="Dashboard"
      screenOptions={{
        drawerPosition: rtl ? "right" : "left",
        headerStyle: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: font.black, fontSize: 18 },
        drawerActiveTintColor: colors.leaf,
        drawerInactiveTintColor: colors.ink,
        drawerActiveBackgroundColor: colors.leafSoft,
        drawerLabelStyle: { fontWeight: font.black, fontSize: 14 }
      }}
      drawerContent={(props) => <CustomDrawerContent {...props} onSignOut={confirmSignOut} />}
    >
      <Drawer.Screen
        name="Dashboard"
        options={{
          title: t("dashboard.title"),
          drawerIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.dashboard")}</Text>
        }}
      >
        {() => <OwnerScreen onSignOut={onSignOut} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="CloseStore"
        options={{
          title: t("nav.closeStore"),
          drawerIcon: ({ color, size }) => <Feather name="check-square" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.closeStore")}</Text>
        }}
      >
        {() => <EmployeeScreen onSignOut={onSignOut} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="AllStores"
        component={AllStoresScreen}
        options={{
          title: t("nav.allStores"),
          drawerIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.allStores")}</Text>
        }}
      />

      <Drawer.Screen
        name="AdminStores"
        component={AdminStoresScreen}
        options={{
          title: t("nav.adminStores"),
          drawerIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.adminStores")}</Text>
        }}
      />

      <Drawer.Screen
        name="AdminEmployees"
        component={AdminEmployeesScreen}
        options={{
          title: t("nav.adminEmployees"),
          drawerIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.adminEmployees")}</Text>
        }}
      />

      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: t("nav.reports"),
          drawerIcon: ({ color, size }) => <Feather name="download" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.reports")}</Text>
        }}
      />

      <Drawer.Screen
        name="SettingsRoot"
        component={SettingsStackScreen}
        options={{
          title: t("nav.settings"),
          drawerIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />,
          drawerLabel: ({ color }) => <Text style={[s.navLabel, { color }]}>{t("nav.settings")}</Text>
        }}
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
  navLabel: { fontWeight: font.black, fontSize: 14, marginLeft: -16 },
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
