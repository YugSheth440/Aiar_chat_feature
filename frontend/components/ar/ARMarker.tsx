import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import type { TrackedTarget } from '../../store/arTrackingStore';
import type { ARDisclosureLevel } from '../../src/types';
import { ARRing } from './ARRing';
import { ARLabel } from './ARLabel';

// ─── Type-to-color map (SRS §17 + iOS color palette) ──────────────────────
export const TYPE_COLOR: Record<string, string> = {
  primary_hazard:    '#FF3B30', // iOS red (Hazards)
  threat_multiplier: '#30D158', // iOS green (Other objects)
  mitigation_tool:   '#30D158', // iOS green (Other objects)
  neutral_context:   '#30D158', // iOS green (Other objects)
};

// ─── Opacity rules per disclosure level ────────────────────────────────────
export function resolveOpacity(
  target: TrackedTarget,
  level: ARDisclosureLevel,
  spotlightTargetId: string | null,
  activeStepId: string | null,
  chatFocusTargetId: string | null,
): number {
  if (target.isLost) return 0;
  
  // Return same high opacity for all active markers to prevent dimming/blurring
  return 0.85;
}

// ─── Props ─────────────────────────────────────────────────────────────────
interface Props {
  target: TrackedTarget;
  level: ARDisclosureLevel;
  spotlightTargetId: string | null;
  activeStepId: string | null;
  chatFocusTargetId: string | null;
  // Whether any step is active (for ring animation speed)
  hasActiveStep: boolean;
}

/**
 * ARMarker — renders a single tracked spatial target with:
 *  - Smooth SharedValue position from smoothedBox (no jitter)
 *  - Disclosure-level-driven opacity (Progressive Disclosure)
 *  - ARRing (pulsing, depth-scaled)
 *  - ARLabel (ankle-tag, entrance animation)
 */
export function ARMarker({
  target,
  level,
  spotlightTargetId,
  activeStepId,
  chatFocusTargetId,
  hasActiveStep,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Calculate screen coordinates dynamically on the UI thread!
  // This NEVER triggers a React re-render.
  const cx = useDerivedValue(() => {
    const [nx1, ny1, nx2, ny2] = target.boxSV.value;
    return ((nx1 + nx2) / 2) * screenW;
  });

  const cy = useDerivedValue(() => {
    const [nx1, ny1, nx2, ny2] = target.boxSV.value;
    return ((ny1 + ny2) / 2) * screenH;
  });

  const r = useDerivedValue(() => {
    const [nx1, ny1, nx2, ny2] = target.boxSV.value;
    const w = Math.abs(nx2 - nx1) * screenW;
    const h = Math.abs(ny2 - ny1) * screenH;
    const baseR = Math.max(w, h) / 2;
    const ds = 0.75 + (target.depth_hint ?? 0.5) * 0.5;
    return baseR * ds;
  });

  const targetOpacity = useMemo(() => resolveOpacity(
    target, level, spotlightTargetId, activeStepId, chatFocusTargetId
  ), [target, level, spotlightTargetId, activeStepId, chatFocusTargetId]);

  const opacity = useSharedValue(targetOpacity);
  useEffect(() => {
    opacity.value = withTiming(targetOpacity, { duration: 280 });
  }, [targetOpacity]);

  const color     = TYPE_COLOR[target.type] ?? TYPE_COLOR.neutral_context;
  const isCompact = level === 'DETECTION';
  const isActive  = target.step_reference === activeStepId && hasActiveStep;
  const mounted   = targetOpacity > 0.1;

  // Zero-opacity targets: skip rendering entirely for performance
  if (targetOpacity === 0 && !target.isLost) return null;

  return (
    <>
      <ARRing
        cx={cx} cy={cy} r={r}
        opacity={opacity}
        color={color}
        isCompact={isCompact}
        isActive={isActive}
      />
      <ARLabel
        cx={cx} cy={cy} ringR={r}
        label={target.label}
        opacity={opacity}
        color={color}
        isCompact={isCompact}
        mounted={mounted}
      />
    </>
  );
}
