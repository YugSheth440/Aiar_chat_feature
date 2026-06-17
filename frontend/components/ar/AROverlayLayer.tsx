import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useARTrackingStore } from '../../store/arTrackingStore';
import { useARDisclosureLevel } from '../../hooks/useARDisclosureLevel';
import { useWorkflowStore } from '../../store/workflowStore';
import { ARMarker, TYPE_COLOR, resolveOpacity } from './ARMarker';
import { ARConnector } from './ARConnector';
import { ARLabelNative } from './ARLabel';

// ─── Native Label Overlay (Resolves text coordinates outside Canvas) ─────────
function ARLabelNativeOverlay({
  target,
  level,
  spotlightTargetId,
  activeStepId,
  chatFocusTargetId,
}: {
  target: any;
  level: any;
  spotlightTargetId: string | null;
  activeStepId: string | null;
  chatFocusTargetId: string | null;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();

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

  const targetOpacity = useMemo(() => {
    return resolveOpacity(target, level, spotlightTargetId, activeStepId, chatFocusTargetId);
  }, [target, level, spotlightTargetId, activeStepId, chatFocusTargetId]);

  const opacity = useSharedValue(targetOpacity);
  React.useEffect(() => {
    opacity.value = withTiming(targetOpacity, { duration: 280 });
  }, [targetOpacity]);

  const color     = TYPE_COLOR[target.type] ?? TYPE_COLOR.neutral_context;
  const isCompact = level === 'DETECTION';
  const mounted   = targetOpacity > 0.1;

  if (targetOpacity === 0 && !target.isLost) return null;

  return (
    <ARLabelNative
      cx={cx}
      cy={cy}
      ringR={r}
      label={target.label}
      opacity={opacity}
      color={color}
      isCompact={isCompact}
      mounted={mounted}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────
export function AROverlayLayer() {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const targets           = useARTrackingStore((s) => s.targets);
  const workflowState     = useWorkflowStore((s) => s.workflowState);
  const completedStepIds  = useWorkflowStore((s) => s.completedStepIds);

  const {
    level,
    activeStepId,
    chatFocusTargetId,
    spotlightTargetId,
  } = useARDisclosureLevel();

  // Only render when there's something to show
  const shouldRender =
    targets.length > 0 &&
    (workflowState === 'HAZARDS_DISCOVERED' ||
     workflowState === 'HAZARD_FOCUSED' ||
     workflowState === 'SHEET_OPEN');

  const hazardTarget = targets.find((t) => t.type === 'primary_hazard' && !t.isLost);
  const stepTarget   = targets.find((t) => t.step_reference === activeStepId && !t.isLost);
  const shouldConnect = level === 'STEP_GUIDANCE' && !!activeStepId && !!hazardTarget && !!stepTarget;

  const connectorOpacity = useSharedValue(0);
  React.useEffect(() => {
    connectorOpacity.value = withTiming(shouldConnect ? 0.9 : 0, { duration: 300 });
  }, [shouldConnect]);

  const connFromX = useDerivedValue(() => {
    if (!hazardTarget) return 0;
    const [hx1, hy1, hx2, hy2] = hazardTarget.boxSV.value;
    return ((hx1 + hx2) / 2) * screenW;
  });
  
  const connFromY = useDerivedValue(() => {
    if (!hazardTarget) return 0;
    const [hx1, hy1, hx2, hy2] = hazardTarget.boxSV.value;
    return ((hy1 + hy2) / 2) * screenH;
  });

  const connToX = useDerivedValue(() => {
    if (!stepTarget) return screenW / 2;
    const [sx1, sy1, sx2, sy2] = stepTarget.boxSV.value;
    return ((sx1 + sx2) / 2) * screenW;
  });

  const connToY = useDerivedValue(() => {
    if (!stepTarget) return screenH / 2;
    const [sx1, sy1, sx2, sy2] = stepTarget.boxSV.value;
    return ((sy1 + sy2) / 2) * screenH;
  });

  if (!shouldRender) return null;

  const hasActiveStep = !!activeStepId;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Canvas drawing rings, laser paths, and line tags */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* L3 connector — single path between hazard and step target */}
        <ARConnector
          fromX={connFromX}
          fromY={connFromY}
          toX={connToX}
          toY={connToY}
          opacity={connectorOpacity}
          color="#30D158"
        />

        {/* All tracked Skia markers (Rings + Lines pointing to tag location) */}
        {targets.map((target) => (
          <ARMarker
            key={target.id}
            target={target}
            level={level}
            spotlightTargetId={spotlightTargetId}
            activeStepId={activeStepId}
            chatFocusTargetId={chatFocusTargetId}
            hasActiveStep={hasActiveStep}
          />
        ))}
      </Canvas>

      {/* 2. Platform Native Text Labels (positioned absolutely over Canvas) */}
      {targets.map((target) => (
        <ARLabelNativeOverlay
          key={target.id}
          target={target}
          level={level}
          spotlightTargetId={spotlightTargetId}
          activeStepId={activeStepId}
          chatFocusTargetId={chatFocusTargetId}
        />
      ))}
    </View>
  );
}
