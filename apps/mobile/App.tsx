import { Component, ReactNode, useCallback, useEffect, useRef, useState } from "react";
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

const WEB_URL = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

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

type NativeErrorBoundaryProps = { children: ReactNode };
type NativeErrorBoundaryState = { hasError: boolean };

class NativeErrorBoundary extends Component<NativeErrorBoundaryProps, NativeErrorBoundaryState> {
  state: NativeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <View style={styles.center}>
            <Text style={styles.brand}>Daily Close</Text>
            <Text style={styles.errTitle}>App needs to restart</Text>
            <Text style={styles.errBody}>Close and reopen the app. If it keeps happening, install the latest build.</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
}

function App() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      } catch {
        /* Non-fatal. The OS can prompt again when the user uploads. */
      }
    })();
  }, []);

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

  const retry = useCallback(() => {
    setError(false);
    setFirstLoadDone(false);
    webRef.current?.reload();
  }, []);

  const onShouldStartLoad = useCallback((req: { url: string }) => {
    const url = req.url;
    if (url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("sms:")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

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
            <Text style={styles.errBody}>Check your internet connection and try again.</Text>
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
            injectedJavaScript={INJECTED_DOWNLOAD_JS}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            allowFileAccess
            allowsBackForwardNavigationGestures
            onLoadStart={() => {
              if (!firstLoadDone) setError(false);
            }}
            onLoadProgress={(event) => {
              if (event.nativeEvent.progress >= 0.9) {
                setFirstLoadDone(true);
              }
            }}
            onContentProcessDidTerminate={() => {
              setFirstLoadDone(false);
              setError(false);
              webRef.current?.reload();
            }}
            onError={(e: WebViewErrorEvent) => {
              if (e.nativeEvent.url?.startsWith(WEB_URL)) setError(true);
            }}
            onHttpError={(_e: WebViewHttpErrorEvent) => {
              /* The web app handles HTTP error pages. */
            }}
            style={styles.web}
          />
        )}

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

function Root() {
  return (
    <NativeErrorBoundary>
      <App />
    </NativeErrorBoundary>
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

export default SENTRY_DSN ? Sentry.wrap(Root) : Root;
