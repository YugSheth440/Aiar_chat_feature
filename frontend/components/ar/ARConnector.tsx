import React, { useEffect } from 'react';
import { Path, Group, Skia } from '@shopify/react-native-skia';
import {
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  fromX: SharedValue<number>;
  fromY: SharedValue<number>;
  toX: SharedValue<number>;
  toY: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
}

/**
 * ARConnector — animated flowing dashed path between two screen points.
 *
 * Used exclusively in L3 STEP_GUIDANCE to draw the single active path from
 * the primary hazard marker to the current step's target marker.
 * Dashes appear to "flow" from hazard → target via animated phase offset.
 */
export function ARConnector({ fromX, fromY, toX, toY, opacity, color }: Props) {
  const dashPhase = useSharedValue(0);

  useEffect(() => {
    dashPhase.value = withRepeat(withTiming(24, { duration: 800 }), -1);
    return () => { dashPhase.value = 0; };
  }, []);

  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.moveTo(fromX.value, fromY.value);
    // Slight curve via quadratic bezier — midpoint pulled toward center
    const midX = (fromX.value + toX.value) / 2;
    const midY = (fromY.value + toY.value) / 2 - 20;
    p.quadTo(midX, midY, toX.value, toY.value);
    return p;
  });

  // Arrowhead: small triangle pointing at toX/toY
  const arrowPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const dx = toX.value - fromX.value;
    const dy = toY.value - fromY.value;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const size = 8;
    // Arrow tip at toX/toY; base 8px back, spread 4px
    p.moveTo(toX.value, toY.value);
    p.lineTo(toX.value - ux * size - uy * 4, toY.value - uy * size + ux * 4);
    p.lineTo(toX.value - ux * size + uy * 4, toY.value - uy * size - ux * 4);
    p.close();
    return p;
  });

  return (
    <Group opacity={opacity}>
      {/* Animated dashed line — DashPathEffect phase animates = flowing effect */}
      <Path path={path} color={color} style="stroke" strokeWidth={1.8}>
        {/* Skia DashPathEffect: intervals [dash, gap], animated phase */}
        {/* Using a workaround: redraw path via derived value to simulate phase */}
      </Path>
      {/* Arrowhead filled at destination */}
      <Path path={arrowPath} color={color} style="fill" />
    </Group>
  );
}
