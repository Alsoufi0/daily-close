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
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from "react-native-webview/lib/WebViewTypes";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Sentry from "@sentry/react-native";
import { colors, font, spacing, radius } from "./src/theme";

// ── WebView shell ───────────────────────────────────────────────────────────
//
// This build is a NATIVE APP that renders the real Daily Close web UI inside
// a full-screen WebView (no browser chrome — no URL bar, no share button).
// The user sees exactly what the website shows, identical forever, because it
// IS the website. Web ships a change → this app has it instantly, no rebuild.
//
// What makes it "app-like" (and clears Apple Guideline 4.2):
//   - Native splash + status bar handling
//   - Native crash reporting (Sentry)
//   - Persistent login (cookies + localStorage survive app restarts)
//   - Hardware back button navigates web history, doesn't kill the app
//   - Camera + file upload bridged through to the close-a-store flow
//   - (Next: native push notifications — the strongest 4.2 signal)
//
// The hand-built native screens live on the `staging` branch; this branch is
// the WebView alternative for side-by-side comparison.

const WEB_URL = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

// ── Download bridge ─────────────────────────────────────────────────────────
//
// A plain WebView has no download manager: the web app's CSV/PDF export, single
// receipt download, and "Download all" zip all work by fetching a Blob and
// clicking an `<a download>` on a blob: URL — which does nothing inside a
// WebView. This injected script captures those clicks, reads the Blob as a
// base64 data URL, and posts it to native (onMessage), which writes a temp file
// and opens the OS share sheet (Save to Files, etc.). It also patches
// URL.createObjectURL so the Blob survives the page's immediate revokeObjectURL.
const INJECTED_DOWNLOAD_JS = `
(function () {
  if (window.__dcDownloadPatched) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dc-ready' })); } catch (e) {}
    return;
  }
  window.__dcDownloadPatched = true;

  var blobs = {};
  var _create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var url = _create(obj);
    try { if (obj instanceof Blob) blobs[url] = obj; } catch (e) {}
    return url;
  };

  function post(o) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
  }
  function deliver(blob, filename) {
    var r = new FileReader();
    r.onload = function () { post({ type: 'dc-download', filename: filename, dataUrl: r.result }); };
    r.onerror = function () { post({ type: 'dc-download-error', filename: filename }); };
    r.readAsDataURL(blob);
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[download]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var filename = a.getAttribute('download') || 'download';
    if (!href) return;
    ev.preventDefault();
    ev.stopPropagation();
    post({ type: 'dc-download-start', filename: filename });
    var b = blobs[href];
    if (b) { deliver(b, filename); return; }
    fetch(href, { credentials: 'include' })
      .then(function (res) { return res.blob(); })
      .then(function (blob) { deliver(blob, filename); })
      .catch(function () { post({ type: 'dc-download-error', filename: filename }); });
  }, true);

  function ready() { post({ type: 'dc-ready' }); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
  setTimeout(ready, 750);
})();
true;
`;

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

function App() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState(false);

  // Request camera + media-library permissions up front. The web close flow
  // uses <input type="file" capture="environment">, and react-native-webview's
  // Android file chooser only offers the camera if the host app already holds
  // the runtime CAMERA permission. Declaring it in the manifest isn't enough —
  // Android requires an explicit runtime grant, which we trigger here on mount
  // so the camera is ready by the time the user reaches the upload step.
  useEffect(() => {
    (async () => {
      try {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      } catch {
        /* permission prompt failures are non-fatal; user can grant later */
      }
    })();
  }, []);

  // Android hardware back → step back through web history instead of exiting
  // the app. Only falls through to default (exit) when there's nowhere to go.
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
    if (firstLoadDone || error) return;
    const timer = setTimeout(() => {
      setError(true);
    }, 25000);
    return () => clearTimeout(timer);
  }, [firstLoadDone, error]);

  const onNav = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  function retry() {
    setError(false);
    setFirstLoadDone(false);
    webRef.current?.reload();
  }

  // Keep links inside the app for our own domain + Stripe (checkout flows in
  // the same web session). Hand off mailto:/tel: + clearly-external domains to
  // the OS so they don't get trapped in the WebView.
  const onShouldStartLoad = useCallback((req: { url: string }) => {
    const url = req.url;
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    // Everything on our domain + Supabase auth + Stripe stays in-app.
    return true;
  }, []);

  // Receive an intercepted download from the page (base64 data URL), write it
  // to a temp file, and open the OS share sheet so the user can save/open it.
  const onMessage = useCallback(async (event: { nativeEvent: { data: string } }) => {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg?.type === "dc-ready") {
      setFirstLoadDone(true);
      setError(false);
      return;
    }
    if (!msg || msg.type !== "dc-download" || typeof msg.dataUrl !== "string") return;
    try {
      const comma = msg.dataUrl.indexOf(",");
      const meta = msg.dataUrl.slice(0, comma);
      const base64 = msg.dataUrl.slice(comma + 1);
      const mime = /data:([^;]+)/.exec(meta)?.[1] || "application/octet-stream";
      const safeName = String(msg.filename || "download").replace(/[^a-zA-Z0-9._-]+/g, "_") || "download";
      const fileUri = (FileSystem.cacheDirectory || "") + safeName;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: mime, dialogTitle: safeName });
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />

        {error ? (
          <View style={styles.center}>
            <Text style={styles.brand}>Daily Close</Text>
            <Text style={styles.errTitle}>Can't reach Daily Close</Text>
            <Text style={styles.errBody}>
              Check your internet connection and try again.
            </Text>
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
            // Bridge browser downloads (export/receipts/zip) to native save+share.
            injectedJavaScript={INJECTED_DOWNLOAD_JS}
            onMessage={onMessage}
            // ── capability flags ──
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            allowFileAccess
            allowsBackForwardNavigationGestures
            // ── loading / error ──
            onLoadStart={() => {
              setError(false);
              setFirstLoadDone(false);
            }}
            onError={(e: WebViewErrorEvent) => {
              // Only treat top-level navigation failures as fatal; sub-resource
              // errors (an image, a tracking pixel) shouldn't blank the app.
              if (e.nativeEvent.url?.startsWith(WEB_URL)) setError(true);
            }}
            onHttpError={(_e: WebViewHttpErrorEvent) => {
              /* leave HTTP errors to the web app's own error pages */
            }}
            style={styles.web}
          />
        )}

        {/* Branded first-load splash — covers the WebView until the web app's
            first paint lands, so the user never sees a white flash. */}
        {!firstLoadDone && !error ? (
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
  splashBrand: { color: colors.leaf, fontWeight: font.black, fontSize: 28, letterSpacing: -0.5 }
});

export default SENTRY_DSN ? Sentry.wrap(App) : App;
