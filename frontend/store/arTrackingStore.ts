import { create } from 'zustand';
import type {
  SpatialTarget,
  ARDisclosureLevel,
  SpatialTargetType,
  MarkerType,
  RiskLevel,
} from '../src/types';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

// ─── TrackedTarget ───────────────────────────────────────────────────────────
// A VLM-initialized target that is maintained by the local IoU tracker.
// AR markers read `smoothedBox`, never the raw VLM box.
export interface TrackedTarget {
  id: string;                    // matches spatial_target.id
  hazard_ref: string;
  label: string;
  type: SpatialTargetType;
  marker_type: MarkerType;
  step_reference: string | null;
  depth_hint: number;
  priority: number;
  risk_level: RiskLevel;

  vlmBox: number[];              // original VLM box (normalized 0–1)
  liveBox: number[];             // current tracker-updated box
  smoothedBox: number[];         // lerp-smoothed for jitter-free rendering
  boxSV: SharedValue<number[]>;  // UI-thread reactive value for 60fps tracking without React renders
  lostFrames: number;            // frames since last tracker match
  isLost: boolean;               // true after LOST_THRESHOLD frames without match
}

// ─── Constants ───────────────────────────────────────────────────────────────
const LOST_THRESHOLD = 30;    // frames before a target is considered lost
const SMOOTH_ALPHA   = 0.18;  // lerp alpha: ~300ms to settle, no snap/jitter

function lerp(prev: number[], next: number[], alpha: number): number[] {
  return prev.map((v, i) => v + (next[i] - v) * alpha);
}

function calculateIoU(a: number[], b: number[]): number {
  const [ax1, ay1, ax2, ay2] = a;
  const [bx1, by1, bx2, by2] = b;
  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  if (ix2 < ix1 || iy2 < iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const areaA = (ax2 - ax1) * (ay2 - ay1);
  const areaB = (bx2 - bx1) * (by2 - by1);
  return inter / (areaA + areaB - inter);
}

// ─── Store Interface ─────────────────────────────────────────────────────────
interface ARTrackingState {
  targets: TrackedTarget[];
  disclosureLevel: ARDisclosureLevel;
  chatFocusTargetId: string | null;

  // Actions
  initFromVLM: (spatialTargets: SpatialTarget[]) => void;
  updateFromTracker: (trackerBoxes: { id: string; box: number[] }[]) => void;
  setDisclosureLevel: (level: ARDisclosureLevel) => void;
  setChatFocusTarget: (id: string | null) => void;
  clear: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────
export const useARTrackingStore = create<ARTrackingState>((set, get) => ({
  targets: [],
  disclosureLevel: 'DETECTION',
  chatFocusTargetId: null,

  // Called once after VLM response arrives — initializes all tracked targets.
  // VLM box is also the initial liveBox and smoothedBox.
  initFromVLM: (spatialTargets) => {
    const seenIds = new Set<string>();
    const targets: TrackedTarget[] = [];
    
    (spatialTargets || []).forEach((t, index) => {
      // VLM sometimes returns 0-1000 instead of 0.0-1.0
      // Fallback to [0,0,0,0] if box_2d is missing to prevent map crashes
      const box = (t.box_2d || [0,0,0,0]).map(v => v > 1 ? v / 1000 : v);
      
      let targetId = t.id ? String(t.id).trim() : `tgt_${index}`;
      if (!targetId || seenIds.has(targetId)) {
        targetId = `${targetId || 'tgt'}_${index}`;
      }
      seenIds.add(targetId);

      targets.push({
        id:             targetId,
        hazard_ref:     t.hazard_ref,
        label:          t.label,
        type:           t.type,
        marker_type:    t.marker_type,
        step_reference: t.step_reference ?? null,
        depth_hint:     t.depth_hint ?? 0.5,
        priority:       t.priority,
        risk_level:     t.risk_level,
        vlmBox:         [...box],
        liveBox:        [...box],
        smoothedBox:    [...box],
        boxSV:          makeMutable([...box]),
        lostFrames:     0,
        isLost:         false,
      });
    });
    set({ targets, disclosureLevel: 'DETECTION' });
  },

  // Called every frame from CameraView (via Worklets.createRunOnJS).
  // IoU-matches TFLite detections against each target's liveBox,
  // updates liveBox with the best match, and lerp-smooths into smoothedBox.
  // Targets with no match for >LOST_THRESHOLD frames are marked isLost.
  updateFromTracker: (trackerBoxes) => {
    const { targets } = get();
    if (targets.length === 0) return;

    let stateChanged = false;

    const updated = targets.map((target) => {
      const IOU_THRESHOLD = 0.3;
      let bestMatch: { id: string; box: number[] } | null = null;
      let bestIoU = IOU_THRESHOLD;

      for (const tb of trackerBoxes) {
        const iou = calculateIoU(target.liveBox, tb.box);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestMatch = tb;
        }
      }

      if (bestMatch) {
        const newLive = bestMatch.box;
        const currentSmoothed = target.boxSV.value;
        const newSmoothed = lerp(currentSmoothed, newLive, SMOOTH_ALPHA);
        
        target.boxSV.value = newSmoothed; // Updates UI thread instantly!
        
        const newIsLost = false;
        if (target.isLost !== newIsLost) stateChanged = true;

        return {
          ...target,
          liveBox:     newLive,
          smoothedBox: newSmoothed, // Create new object instead of inline mutation
          lostFrames:  0,
          isLost:      newIsLost,
        };
      } else {
        // No tracker match — increment lost counter, keep last smoothed position
        const lostFrames = target.lostFrames + 1;
        const newIsLost = lostFrames > LOST_THRESHOLD;
        if (target.isLost !== newIsLost) stateChanged = true;

        const currentSmoothed = target.boxSV.value;
        const newSmoothed = lerp(currentSmoothed, target.liveBox, SMOOTH_ALPHA * 0.5);
        target.boxSV.value = newSmoothed; // Updates UI thread instantly!

        return {
          ...target,
          smoothedBox: newSmoothed, // Create new object
          lostFrames,
          isLost: newIsLost,
        };
      }
    });

    // ONLY trigger a React re-render if a target was lost or found!
    // High-frequency coordinate updates bypass React via boxSV mutation.
    if (stateChanged) {
      set({ targets: updated });
    }
  },

  setDisclosureLevel: (disclosureLevel) => set({ disclosureLevel }),
  setChatFocusTarget: (chatFocusTargetId) => set({ chatFocusTargetId }),
  clear: () => {
    arOffsetX.value = 0;
    arOffsetY.value = 0;
    set({ targets: [], disclosureLevel: 'DETECTION', chatFocusTargetId: null });
  },
}));

export const arOffsetX = makeMutable(0);
export const arOffsetY = makeMutable(0);
