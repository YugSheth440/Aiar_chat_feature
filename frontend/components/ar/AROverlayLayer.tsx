import React, { useMemo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useARTrackingStore, TrackedTarget, arOffsetX, arOffsetY } from '../../store/arTrackingStore';
import { useWorkflowStore } from '../../store/workflowStore';
import { ARMarker } from './ARMarker';
import { ARLabelNative } from './ARLabel';

// Helper to convert workflowStore component to virtual TrackedTarget
function useVirtualTargets() {
  const { components, activeComponentIndex, workflowState, guideSteps, activeStepIndex, activeMode, relatedParts } = useWorkflowStore();

  return useMemo(() => {
    return components.map((comp, idx) => {
      // Determine if active / faded / hidden based on state & activeMode
      let isActive = false;
      let isFaded = false;
      let isHidden = false;

      if (workflowState === 'GUIDE_MODE') {
        const currentStep = guideSteps[activeStepIndex];
        isActive = comp.id === currentStep?.componentId;
        // In Guide mode, only the target component glows, others fade
        isFaded = !isActive;
      } else {
        isActive = idx === activeComponentIndex;
        if (activeMode === 'troubleshoot') {
          // Troubleshoot mode: only related components are visible
          const parts = relatedParts || ['cooling_fan', 'motor_body'];
          const isRelated = parts.includes(comp.id);
          if (!isRelated) {
            isHidden = true;
          }
        } else if (activeMode === 'explain') {
          // Explain mode: only the currently active component is visible
          if (!isActive) {
            isHidden = true;
          }
        }
      }

      // Create a mock boxSV resembling shared value structure
      const boxSV = { value: comp.box_2d };

      return {
        id: comp.id,
        hazard_ref: 'haz_motor',
        label: comp.label,
        type: isActive ? 'primary_hazard' : 'neutral_context',
        marker_type: 'ring',
        step_reference: null,
        depth_hint: 0.5,
        priority: 1,
        risk_level: 'LOW',
        vlmBox: comp.box_2d,
        liveBox: comp.box_2d,
        smoothedBox: comp.box_2d,
        boxSV,
        lostFrames: 0,
        isLost: false,
        isActive,
        isFaded,
        isHidden,
      } as any;
    });
  }, [components, activeComponentIndex, workflowState, guideSteps, activeStepIndex, activeMode, relatedParts]);
}

// ─── Native Label Overlay ────────────────────────────────────────────────
function ARLabelNativeOverlay({
  target,
  isActive,
  isFaded,
  onPress,
}: {
  target: any;
  isActive: boolean;
  isFaded: boolean;
  onPress: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();

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
    return baseR;
  });

  // Calculate dynamic Euclidean distance to screen center
  const distance = useDerivedValue(() => {
    const centerScreenX = screenW / 2;
    const centerScreenY = screenH / 2;
    const dx = cx.value - centerScreenX;
    const dy = cy.value - centerScreenY;
    return Math.sqrt(dx * dx + dy * dy);
  });

  // Derived smoothstep opacity based on proximity to center
  const opacity = useDerivedValue(() => {
    if (isFaded) {
      const r_in = 80;
      const r_out = 250;
      const d = distance.value;
      const t = Math.max(0, Math.min(1, (d - r_in) / (r_out - r_in)));
      const smooth = 3 * t * t - 2 * t * t * t;
      const proximity = 1 - smooth;
      return 0.05 + 0.05 * proximity;
    }

    if (isActive) return 1.0;

    const r_in = 80;
    const r_out = 250;
    const d = distance.value;

    const t = Math.max(0, Math.min(1, (d - r_in) / (r_out - r_in)));
    const smooth = 3 * t * t - 2 * t * t * t;
    const proximity = 1 - smooth; // 1.0 when centered, 0.0 when far

    return 0.45 + (1.0 - 0.45) * proximity;
  });

  const color = isActive ? '#10B981' : 'rgba(255,255,255,0.45)';

  return (
    <ARLabelNative
      cx={cx}
      cy={cy}
      ringR={r}
      label={target.label}
      opacity={opacity}
      color={color}
      isCompact={false}
      mounted={true}
      onPress={onPress}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────
export function AROverlayLayer() {
  const socketTargets = useARTrackingStore((s) => s.targets);
  const workflowState = useWorkflowStore((s) => s.workflowState);
  const { components, setActiveComponentIndex } = useWorkflowStore();
  
  const virtualTargets = useVirtualTargets();

  const isSimulated =
    workflowState === 'EXPLORE_LABELS' ||
    workflowState === 'GUIDE_MODE' ||
    workflowState === 'VOICE_SPEAKING' ||
    workflowState === 'VOICE_ACTIVE';

  const shouldRender =
    isSimulated ||
    (socketTargets.length > 0 &&
      ((workflowState as any) === 'HAZARDS_DISCOVERED' ||
       (workflowState as any) === 'HAZARD_FOCUSED' ||
       (workflowState as any) === 'SHEET_OPEN'));

  if (!shouldRender) return null;

  const displayTargets = isSimulated ? virtualTargets : socketTargets;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="box-none">
      {/* 1. Canvas drawing rings and connector lines */}
      <Canvas style={StyleSheet.absoluteFill}>
        {displayTargets.map((target: any) => {
          if (target.isHidden) return null;
          
          const isActive = isSimulated ? target.isActive : true;
          const isFaded = isSimulated ? target.isFaded : false;
          
          // Map to DETECTION_FADED (which returns 0.05 opacity) if faded
          const levelVal = isActive ? 'HAZARD_FOCUS' : (isFaded ? 'DETECTION_FADED' : 'DETECTION');
          
          return (
            <ARMarker
              key={target.id}
              target={target}
              level={levelVal as any}
              spotlightTargetId={null}
              activeStepId={null}
              chatFocusTargetId={null}
              hasActiveStep={false}
            />
          );
        })}
      </Canvas>

      {/* 2. Platform Native Text Labels */}
      {displayTargets.map((target: any) => {
        if (target.isHidden) return null;
        
        const isActive = isSimulated ? target.isActive : true;
        const isFaded = isSimulated ? target.isFaded : false;
        
        const handlePress = () => {
          const idx = components.findIndex((c) => c.id === target.id);
          if (idx !== -1) {
            setActiveComponentIndex(idx);
          }
        };

        return (
          <ARLabelNativeOverlay
            key={target.id}
            target={target}
            isActive={isActive}
            isFaded={isFaded}
            onPress={handlePress}
          />
        );
      })}
    </View>
  );
}

