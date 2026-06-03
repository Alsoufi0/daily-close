import { useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { clearToken, deleteMyAccount } from "../api";
import { colors, font, radius, spacing } from "../theme";

/**
 * Footer for any authenticated screen — bundles the two store-readiness items
 * Apple gates on:
 *   - "Subscribe / Manage on web" link (iOS only, opens the system browser
 *     so we don't trigger Apple's IAP requirement — see the May 2025 Epic
 *     ruling: external purchase links are allowed in the US App Store).
 *   - "Delete account" button (Guideline 5.1.1(v) — in-app deletion required).
 *
 * Owners see both. Employees see just Delete account.
 */
export function AccountFooter({
  role,
  onSignOut
}: {
  role: "owner" | "employee";
  onSignOut: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  function openBilling() {
    // Use the system browser, not an in-app WebView — Apple is strict about
    // the latter. APP_URL_PUBLIC is baked at build time via Expo's `extra`.
    const base = process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us";
    Linking.openURL(`${base.replace(/\/+$/, "")}/billing`).catch(() => {});
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "Permanently removes your sign-in, cancels any active subscription, and detaches your stores. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyAccount();
              await clearToken();
              onSignOut();
            } catch (err: any) {
              setDeleting(false);
              Alert.alert("Couldn't delete account", err?.message || "Try again.");
            }
          }
        }
      ]
    );
  }

  return (
    <View style={s.wrap}>
      {role === "owner" && Platform.OS === "ios" ? (
        <TouchableOpacity onPress={openBilling} style={s.linkRow}>
          <Text style={s.linkLabel}>Subscribe / Manage on web ↗</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={confirmDelete}
        disabled={deleting}
        style={[s.dangerRow, deleting && { opacity: 0.5 }]}
      >
        <Text style={s.dangerLabel}>{deleting ? "Deleting…" : "Delete account"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.smoke,
    gap: spacing.sm
  },
  linkRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.smoke
  },
  linkLabel: {
    color: colors.ink,
    fontWeight: font.black,
    fontSize: 14,
    textAlign: "center"
  },
  signOutRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white
  },
  signOutLabel: {
    color: colors.ink,
    fontWeight: font.black,
    fontSize: 14,
    textAlign: "center"
  },
  dangerRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  dangerLabel: {
    color: colors.warning,
    fontWeight: font.black,
    fontSize: 14,
    textAlign: "center"
  }
});
