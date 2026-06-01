import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView, WebViewNavigation } from "react-native-webview";
import type { WebViewErrorEvent } from "react-native-webview/lib/WebViewTypes";
import { colors, font, spacing, radius } from "./src/theme";

declare const process: { env?: Record<string, string | undefined> };

const WEB_URL = ((process.env || {}).EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

const READY_SCRIPT = `
(function () {
  function postReady() {
    try { window.ReactNativeWebView.postMessage('daily-close-ready'); } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', postReady, { once: true });
  } else {
    postReady();
  }
  setTimeout(postReady, 500);
})();
true;
`;

function App() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  useEffect(() => {
    if (ready || error) return;
    const timer = setTimeout(() => setError(true), 30000);
    return () => clearTimeout(timer);
  }, [ready, error]);

  const retry = useCallback(() => {
    setReady(false);
    setError(false);
    webRef.current?.reload();
  }, []);

  const onNav = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    if (event.nativeEvent.data === "daily-close-ready") {
      setReady(true);
      setError(false);
    }
  }, []);

  const onShouldStartLoad = useCallback((req: { url: string }) => {
    const url = req.url;
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />

        {error ? (
          <View style={styles.center}>
            <Text style={styles.brand}>Daily Close</Text>
            <Text style={styles.errTitle}>Can't open Daily Close</Text>
            <Text style={styles.errBody}>Check your connection and try again.</Text>
            <TouchableOpacity style={styles.retry} onPress={retry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: WEB_URL }}
            originWhitelist={["*"]}
            onNavigationStateChange={onNav}
            onShouldStartLoadWithRequest={onShouldStartLoad}
            injectedJavaScript={READY_SCRIPT}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowFileAccess
            allowsBackForwardNavigationGestures
            onLoadStart={() => {
              if (!ready) setError(false);
            }}
            onLoadProgress={(event) => {
              if (event.nativeEvent.progress >= 0.8) setReady(true);
            }}
            onContentProcessDidTerminate={retry}
            onError={(e: WebViewErrorEvent) => {
              if (e.nativeEvent.url?.startsWith(WEB_URL)) setError(true);
            }}
            style={styles.web}
          />
        )}

        {!ready && !error ? (
          <View style={styles.splash} pointerEvents="none">
            <Text style={styles.splashBrand}>Daily Close</Text>
            <ActivityIndicator size="large" color={colors.leaf} style={{ marginTop: spacing.lg }} />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  brand: { color: colors.leaf, fontWeight: font.black, fontSize: 18, marginBottom: spacing.lg },
  errTitle: { color: colors.ink, fontWeight: font.black, fontSize: 20, textAlign: "center" },
  errBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 14, textAlign: "center", marginTop: spacing.sm },
  retry: {
    marginTop: spacing.lg,
    backgroundColor: colors.leaf,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md
  },
  retryText: { color: colors.white, fontWeight: font.black, fontSize: 15 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  splashBrand: { color: colors.leaf, fontWeight: font.black, fontSize: 28, letterSpacing: 0 }
});

export default App;
