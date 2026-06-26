import { useMemo } from 'react';
import { useWorkflowStore } from '../store/workflowStore';
import { useARTrackingStore } from '../store/arTrackingStore';
import type { ARDisclosureLevel } from '../src/types';

/**
 * useARDisclosureLevel — Progressive Disclosure gatekeeper (V2.1).
 *
 * Derives which AR Disclosure Level is active from three signal sources:
 *   1. workflowState  — what stage the guidance flow is at
 *   2. activeStepId   — which step the user is currently looking at
 *   3. chatActive     — whether Ask AI mode is open
 *
 * Returns:
 *   level             — the ARDisclosureLevel to use in AROverlayLayer / ARMarker
 *   activeStepId      — forwarded for per-marker step filtering
 *   chatFocusTargetId — forwarded for L4 chat spotlight
 *   spotlightTargetId — the single target ID that should be at 100% opacity in L2/L3
 */
export function useARDisclosureLevel(): {
  level: ARDisclosureLevel;
  activeStepId: string | null;
  chatFocusTargetId: string | null;
  spotlightTargetId: string | null;
} {
  const workflowState = useWorkflowStore((s) => s.workflowState);
  const activeStepId  = useWorkflowStore((s) => s.activeStepId);
  const chatFocusTargetId = useARTrackingStore((s) => s.chatFocusTargetId);
  const targets       = useARTrackingStore((s) => s.targets);

  return useMemo(() => {
    // ── L4: Chat Focus ────────────────────────────────────────────────────
    if (chatFocusTargetId) {
      return {
        level: 'CHAT_FOCUS',
        activeStepId,
        chatFocusTargetId,
        spotlightTargetId: chatFocusTargetId,
      };
    }

    // ── L3: Step Guidance ─────────────────────────────────────────────────
    // Active when user has tapped a specific step card.
    if (
      activeStepId &&
      (workflowState === 'GUIDE_MODE')
    ) {
      // Find the target whose step_reference matches the active step
      const stepTarget = targets.find((t) => t.step_reference === activeStepId);
      return {
        level: 'STEP_GUIDANCE',
        activeStepId,
        chatFocusTargetId: null,
        spotlightTargetId: stepTarget?.id ?? null,
      };
    }

    // ── L2: Hazard Focus ──────────────────────────────────────────────────
    // Active when a hazard is selected but no specific step is being focused.
    if (
      workflowState === 'EXPLORE_LABELS'
    ) {
      // Spotlight = highest-priority mitigation_tool for this hazard
      const mitigation = targets
        .filter((t) => t.type === 'mitigation_tool')
        .sort((a, b) => a.priority - b.priority)[0];
      return {
        level: 'HAZARD_FOCUS',
        activeStepId: null,
        chatFocusTargetId: null,
        spotlightTargetId: mitigation?.id ?? null,
      };
    }

    // ── L1: Detection ─────────────────────────────────────────────────────
    // Default: analysis just completed, no sheet open yet.
    return {
      level: 'DETECTION',
      activeStepId: null,
      chatFocusTargetId: null,
      spotlightTargetId: null,
    };
  }, [workflowState, activeStepId, chatFocusTargetId, targets]);
}
