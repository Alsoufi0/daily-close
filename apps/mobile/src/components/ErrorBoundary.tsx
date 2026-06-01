import { Component, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { Button, Card } from "../ui";
import { t } from "../i18n";
import { colors, font, spacing } from "../theme";

/**
 * Last-resort error boundary. Wraps the drawer so any unhandled render
 * error inside a screen shows a recoverable card instead of a white
 * screen. Reports to Sentry so we see the crash in the dashboard even
 * though the user got an in-app fallback.
 *
 * Hot-reload still works because React Native preserves the error
 * boundary across remounts; tapping "Try again" resets the boundary
 * and the offending screen re-renders.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Report to Sentry — same project as the rest of mobile crashes.
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } }
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={s.wrap}>
          <Card style={{ gap: spacing.md }}>
            <Text style={s.title}>{t("common.error")}</Text>
            <Text style={s.body}>{this.state.error.message || "An unexpected error occurred."}</Text>
            <View style={{ height: spacing.sm }} />
            <Button title={t("common.tryAgain")} onPress={this.reset} />
          </Card>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: "center", backgroundColor: colors.bg },
  title: { color: colors.warning, fontWeight: font.black, fontSize: 18 },
  body: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 14 }
});
