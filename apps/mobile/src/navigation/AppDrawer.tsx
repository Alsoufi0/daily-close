import { createDrawerNavigator } from "@react-navigation/drawer";
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from "@react-navigation/drawer";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OwnerScreen } from "../screens/OwnerScreen";
import { EmployeeScreen } from "../screens/EmployeeScreen";
import { AllStoresScreen } from "../screens/AllStoresScreen";
import { AdminStoresScreen } from "../screens/admin/AdminStoresScreen";
import { AdminEmployeesScreen } from "../screens/admin/AdminEmployeesScreen";
import { ReportsScreen } from "../screens/ReportsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors, font, radius, spacing } from "../theme";

export type DrawerParamList = {
  Dashboard: undefined;
  CloseStore: undefined;
  AllStores: undefined;
  AdminStores: undefined;
  AdminEmployees: undefined;
  Reports: undefined;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

export function AppDrawer({ onSignOut }: { onSignOut: () => Promise<void> | void }) {
  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "You'll need to enter your email and password again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => onSignOut() }
      ]
    );
  }

  return (
    <Drawer.Navigator
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
        options={{ title: "Dashboard", drawerLabel: "🏠  Dashboard" }}
      >
        {() => <OwnerScreen onSignOut={onSignOut} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="CloseStore"
        options={{ title: "Close a store", drawerLabel: "🧾  Close a store" }}
      >
        {() => <EmployeeScreen onSignOut={onSignOut} />}
      </Drawer.Screen>

      <Drawer.Screen
        name="AllStores"
        component={AllStoresScreen}
        options={{ title: "All stores", drawerLabel: "🏪  All stores" }}
      />

      <Drawer.Screen
        name="AdminStores"
        component={AdminStoresScreen}
        options={{ title: "Admin · Stores", drawerLabel: "⚙️  Admin: Stores" }}
      />

      <Drawer.Screen
        name="AdminEmployees"
        component={AdminEmployeesScreen}
        options={{ title: "Admin · Employees", drawerLabel: "👥  Admin: Employees" }}
      />

      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: "Reports", drawerLabel: "📄  Reports" }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings", drawerLabel: "🔧  Settings" }}
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
        <Text style={s.headerSubtitle}>Mobile</Text>
      </View>
      <View style={{ flex: 1 }}>
        <DrawerItemList {...rest} />
      </View>
      <TouchableOpacity onPress={onSignOut} style={s.signOutBtn}>
        <Text style={s.signOutText}>Sign out</Text>
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
