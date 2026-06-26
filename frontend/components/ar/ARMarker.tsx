import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import type { TrackedTarget } from '../../store/arTrackingStore';
import { arOffsetX, arOffsetY } from '../../store/arTrackingStore';
import type { ARDisclosureLevel } from '../../src/types';
import { Group } from '@shopify/react-native-skia';
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
  if (level === ('DETECTION_FADED' as any)) return 0.05;
  
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
    return ((nx1 + nx2) / 2) * screenW + arOffsetX.value;
  });

  const cy = useDerivedValue(() => {
    const [nx1, ny1, nx2, ny2] = target.boxSV.value;
    return ((ny1 + ny2) / 2) * screenH + arOffsetY.value;
  });

  const r = useDerivedValue(() => {
    const [nx1, ny1, nx2, ny2] = target.boxSV.value;
    const w = Math.abs(nx2 - nx1) * screenW;
    const h = Math.abs(ny2 - ny1) * screenH;
    const baseR = Math.max(w, h) / 2;
    const ds = 0.75 + (target.depth_hint ?? 0.5) * 0.5;
    return baseR * ds;
  });

  const distance = useDerivedValue(() => {
    const centerScreenX = screenW / 2;
    const centerScreenY = screenH / 2;
    const dx = cx.value - centerScreenX;
    const dy = cy.value - centerScreenY;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const opacity = useDerivedValue(() => {
    if (level === ('DETECTION_FADED' as any)) {
      const r_in = 80;
      const r_out = 250;
      const d = distance.value;
      const t = Math.max(0, Math.min(1, (d - r_in) / (r_out - r_in)));
      const smooth = 3 * t * t - 2 * t * t * t;
      const proximity = 1 - smooth;
      return 0.05 + 0.05 * proximity;
    }

    if (level === 'HAZARD_FOCUS' || target.id === chatFocusTargetId) {
      return 0.85;
    }

    const r_in = 80;
    const r_out = 250;
    const d = distance.value;

    const t = Math.max(0, Math.min(1, (d - r_in) / (r_out - r_in)));
    const smooth = 3 * t * t - 2 * t * t * t;
    const proximity = 1 - smooth;

    return 0.45 + (0.85 - 0.45) * proximity;
  });

  const color     = TYPE_COLOR[target.type] ?? TYPE_COLOR.neutral_context;
  const isCompact = level === 'DETECTION';
  const isActive  = target.step_reference === activeStepId && hasActiveStep;
  const mounted   = true;

  return (
    <Group>
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
    </Group>
  );
}
