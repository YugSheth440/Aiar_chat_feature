import React, { useEffect } from 'react';
import { Circle, Group, Blur } from '@shopify/react-native-skia';
import {
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  r: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
  isCompact: boolean;  // L1: small ring, no pulse
  isActive: boolean;   // L3 spotlight: faster pulse, thicker stroke
}

export function ARRing({ cx, cy, r, opacity, color, isCompact, isActive }: Props) {
  const pulseProgress = useSharedValue(0);
  const pulseOpacity  = useSharedValue(0);

  useEffect(() => {
    const dur = isActive ? 850 : 1800;
    pulseProgress.value = withRepeat(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: dur })),
      -1,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(isCompact ? 0 : 0.55, { duration: 0 }),
        withTiming(0, { duration: dur }),
      ),
      -1,
    );
    return () => { pulseProgress.value = 0; pulseOpacity.value = 0; };
  }, [isCompact, isActive]);

  // All derived in one place so Skia re-renders only when needed
  const innerR      = useDerivedValue(() => isCompact ? r.value * 0.55 : r.value);
  const pulseR      = useDerivedValue(() => r.value + r.value * 0.6 * pulseProgress.value);
  const strokeW     = useDerivedValue(() => isActive ? 3.5 : isCompact ? 1.5 : 2.5);
  const glowBlur    = useDerivedValue(() => isCompact ? 3 : isActive ? 16 : 9);
  const glowOpacity = useDerivedValue(() => isCompact ? 0.25 : isActive ? 0.75 : 0.55);

  return (
    <Group opacity={opacity}>
      {/* Outer expanding pulse */}
      <Group opacity={pulseOpacity}>
        <Circle cx={cx} cy={cy} r={pulseR} color={color} style="stroke" strokeWidth={1.5} />
      </Group>

      {/* Soft glow halo */}
      <Group opacity={glowOpacity}>
        <Circle cx={cx} cy={cy} r={innerR} color={color} style="stroke" strokeWidth={9}>
          <Blur blur={glowBlur} />
        </Circle>
      </Group>

      {/* Crisp inner ring */}
      <Circle cx={cx} cy={cy} r={innerR} color={color} style="stroke" strokeWidth={strokeW} />
    </Group>
  );
}
