import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme";

/**
 * Animated skeleton placeholder. Mirrors what the web shows during
 * dashboard/list loads. Cheap pulse animation — no reanimated needed,
 * uses RN's built-in Animated for a 1.0 → 0.5 → 1.0 opacity loop.
 *
 * Renders a colored box of the given size with a subtle pulse so the
 * user sees layout immediately and the loading feels intentional.
 */
export function Skeleton({
  width,
  height,
  borderRadius = radius.md,
  style
}: {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        s.base,
        { width, height, borderRadius, opacity },
        style
      ]}
    />
  );
}

/** Card-shaped skeleton — used for list items and metric cards */
export function SkeletonCard({ height = 100, style }: { height?: number; style?: ViewStyle }) {
  return (
    <View style={[s.card, style]}>
      <Skeleton width="60%" height={14} borderRadius={4} />
      <View style={{ height: spacing.sm }} />
      <Skeleton width="40%" height={28} borderRadius={4} />
      <View style={{ height: spacing.sm }} />
      <Skeleton width="100%" height={height - 80} borderRadius={4} />
    </View>
  );
}

/** Row-shaped skeleton — used for list rows */
export function SkeletonRow() {
  return (
    <View style={s.row}>
      <Skeleton width={40} height={40} borderRadius={radius.md} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={14} borderRadius={4} />
        <Skeleton width="40%" height={11} borderRadius={4} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: colors.smoke },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  }
});
