// ─── IoU Utilities ──────────────────────────────────────────────────────────
// All functions marked 'worklet' so they can run inside useFrameProcessor.
// IMPORTANT: nextObjId MUST NOT be a module-level variable — worklet contexts
// do not share module-scope state between invocations. The counter is instead
// passed in and returned from assignStableId so the caller (useSharedValue)
// owns it safely on the JS thread.

export function calculateIoU(boxA: number[], boxB: number[]): number {
  'worklet';
  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  const x_left   = Math.max(ax1, bx1);
  const y_top    = Math.max(ay1, by1);
  const x_right  = Math.min(ax2, bx2);
  const y_bottom = Math.min(ay2, by2);

  if (x_right < x_left || y_bottom < y_top) return 0.0;

  const intersection = (x_right - x_left) * (y_bottom - y_top);
  const areaA = (ax2 - ax1) * (ay2 - ay1);
  const areaB = (bx2 - bx1) * (by2 - by1);

  return intersection / (areaA + areaB - intersection);
}

/**
 * Assigns a stable tracking ID to a detected bounding box.
 *
 * @param newBox           Normalized [x1,y1,x2,y2] from current frame
 * @param lastBboxes       Mutable map of id → last known bbox (shared value .value)
 * @param lastSeenFrame    Mutable map of id → last frame number seen (shared value .value)
 * @param currentFrame     Current frame counter
 * @param nextIdRef        Current next-ID counter (shared value .value) — mutated in place
 * @returns                Stable string ID, e.g. "obj_1"
 */
export function assignStableId(
  newBox: number[],
  lastBboxes: Record<string, number[]>,
  lastSeenFrame: Record<string, number>,
  currentFrame: number,
  nextIdCounter: number,
): { id: string; nextIdCounter: number } {
  'worklet';

  const ION_THRESHOLD = 0.5;
  const STALE_FRAMES  = 60;

  let bestId: string | null = null;
  let maxIou = ION_THRESHOLD;

  // Match against all known boxes
  for (const id of Object.keys(lastBboxes)) {
    const iou = calculateIoU(newBox, lastBboxes[id]);
    if (iou > maxIou) {
      maxIou = iou;
      bestId = id;
    }
  }

  // Garbage-collect stale IDs (not seen in 60 frames)
  for (const id of Object.keys(lastSeenFrame)) {
    if (currentFrame - lastSeenFrame[id] > STALE_FRAMES) {
      delete lastBboxes[id];
      delete lastSeenFrame[id];
    }
  }

  if (bestId) {
    lastBboxes[bestId]    = newBox;
    lastSeenFrame[bestId] = currentFrame;
    return { id: bestId, nextIdCounter };
  }

  // New object — use caller-owned counter so it persists between frames
  const newId = `obj_${nextIdCounter}`;
  lastBboxes[newId]    = newBox;
  lastSeenFrame[newId] = currentFrame;
  return { id: newId, nextIdCounter: nextIdCounter + 1 };
}
