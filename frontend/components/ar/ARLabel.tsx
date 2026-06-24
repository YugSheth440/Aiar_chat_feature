import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
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
  onPress?: () => void;
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
export function ARLabelNative({ cx, cy, ringR, label, opacity, color, isCompact, mounted, onPress }: Props) {
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

  // Format label: ensure first letter capitalized
  const formattedLabel = useMemo(() => {
    const safeLabel = label || '';
    return safeLabel.charAt(0).toUpperCase() + safeLabel.slice(1);
  }, [label]);

  // Dynamically calculate background container width based on label length
  const labelW = useMemo(() => {
    return Math.max(formattedLabel.length * 8 + PAD_H * 2 + 10, 85);
  }, [formattedLabel]);

  const animatedStyle = useAnimatedStyle(() => {
    const x = cx.value - labelW / 2;
    const y = cy.value - ringR.value - CONNECTOR_GAP - H + enterOffset.value;
    
    // Calculate dynamic scale driven by proximity-derived opacity
    let scaleVal = 0.90;
    if (opacity.value > 0.45) {
      scaleVal = 0.90 + (1.06 - 0.90) * ((opacity.value - 0.45) / (1.0 - 0.45));
    } else {
      scaleVal = 0.75 + (0.90 - 0.75) * ((opacity.value - 0.05) / (0.45 - 0.05));
    }
    const clampedScale = Math.max(0.70, Math.min(1.12, scaleVal));

    return {
      left: x,
      top: y,
      width: labelW,
      height: H + 4,
      opacity: opacity.value * enterOpacity.value,
      transform: [{ scale: clampedScale }],
    };
  });

  if (isCompact) return null;

  return (
    <Animated.View style={[styles.labelContainer, { borderColor: color, shadowColor: color }, animatedStyle]}>
      <Pressable onPress={onPress} style={styles.pressableContainer}>
        {/* Platform Native text renderer */}
        <Text style={styles.labelText}>{formattedLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(15,18,25,0.85)',
    borderRadius: 99,
    borderWidth: 1.2,
    zIndex: 100,
    // Soft outer glow matching the mockup
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  pressableContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
