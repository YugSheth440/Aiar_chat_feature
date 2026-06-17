import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Group, Line } from '@shopify/react-native-skia';
import Animated, {
  SharedValue,
  useDerivedValue,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  ringR: SharedValue<number>;
  label: string;
  opacity: SharedValue<number>;
  color: string;      // left-edge tag stripe color
  isCompact: boolean; // L1: hide label entirely
  mounted: boolean;   // entrance animation trigger
}

const STRIPE_W  = 3;
const PAD_H     = 10;
const H         = 24;
const CONNECTOR_GAP = 12; // px between ring top and label bottom

// ─── Skia connector line component (rendered inside Skia Canvas) ─────────────
export function ARLabel({ cx, cy, ringR, opacity, color, isCompact, mounted }: Props) {
  // Entrance animation: slide up + fade matching the label container
  const enterOffset  = useSharedValue(10);
  const enterOpacity = useSharedValue(0);

  useEffect(() => {
    if (mounted && !isCompact) {
      enterOffset.value  = withSpring(0, { damping: 18, stiffness: 300 });
      enterOpacity.value = withTiming(1, { duration: 320 });
    } else {
      enterOffset.value  = 10;
      enterOpacity.value = 0;
    }
  }, [mounted, isCompact]);

  // Positions derived from ring center + radius
  const bgY = useDerivedValue(() => cy.value - ringR.value - CONNECTOR_GAP - H + enterOffset.value);

  // Connector line endpoints
  const p1 = useDerivedValue(() => ({ x: cx.value, y: bgY.value + H + 1 }));
  const p2 = useDerivedValue(() => ({ x: cx.value, y: cy.value - ringR.value - 2 }));

  const combinedOp = useDerivedValue(() => opacity.value * enterOpacity.value);

  if (isCompact) return null;

  return (
    <Group opacity={combinedOp}>
      {/* Thin connector from label → ring */}
      <Line
        p1={p1}
        p2={p2}
        color={color}
        strokeWidth={0.9}
        style="stroke"
      />
    </Group>
  );
}

// ─── React Native overlay component (rendered outside Skia Canvas) ───────────
export function ARLabelNative({ cx, cy, ringR, label, opacity, color, isCompact, mounted }: Props) {
  // Entrance animation: slide up + fade matching Skia line
  const enterOffset  = useSharedValue(10);
  const enterOpacity = useSharedValue(0);

  useEffect(() => {
    if (mounted && !isCompact) {
      enterOffset.value  = withSpring(0, { damping: 18, stiffness: 300 });
      enterOpacity.value = withTiming(1, { duration: 320 });
    } else {
      enterOffset.value  = 10;
      enterOpacity.value = 0;
    }
  }, [mounted, isCompact]);

  // Truncate label to maximum of 2 words for clean display (with safety fallback)
  const formattedLabel = useMemo(() => {
    const safeLabel = label || '';
    const words = safeLabel.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(' ');
  }, [label]);

  // Dynamically calculate background container width based on word length
  const labelW = useMemo(() => {
    return Math.max(formattedLabel.length * 7.5 + PAD_H * 2 + STRIPE_W + 6, 70);
  }, [formattedLabel]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = cx.value - labelW / 2;
    const y = cy.value - ringR.value - CONNECTOR_GAP - H + enterOffset.value;
    return {
      left: x,
      top: y,
      width: labelW,
      height: H,
      opacity: opacity.value * enterOpacity.value,
    };
  });

  if (isCompact) return null;

  return (
    <Animated.View style={[styles.labelContainer, animatedStyle]} pointerEvents="none">
      {/* Left indicator stripe */}
      <View style={[styles.stripe, { backgroundColor: color }]} />
      {/* Platform Native text renderer (guaranteed to show correctly) */}
      <Text style={styles.labelText}>{formattedLabel}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8,10,20,0.92)',
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    gap: 6,
    zIndex: 100,
    justifyContent: 'flex-start',
  },
  stripe: {
    width: 3,
    height: '65%',
    borderRadius: 3,
  },
  labelText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
