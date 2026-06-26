import { useEffect, useRef, useCallback } from 'react';
import { BACKEND_WS_URL } from '../src/config';
import { useSceneStore } from '../store/sceneStore';
import { useWorkflowStore } from '../store/workflowStore';
import { useUiStore } from '../store/uiStore';
import { useARTrackingStore } from '../store/arTrackingStore';
import { useChatStore } from '../store/chatStore';
import { validateSceneAnalysis } from '../src/validators';
import type { SceneAnalysis } from '../src/types';

export function useWebSocket() {
  const wsRef           = useRef<WebSocket | null>(null);
  const reconnectCount  = useRef(0);
  const currentBbox     = useRef<number[] | null>(null);

  const { setSceneAnalysis, reset: resetScene }  = useSceneStore();
  const { reset: resetWorkflow }                  = useWorkflowStore();
  const { initFromVLM, clear: clearTracking }     = useARTrackingStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log(`[WS] Connecting to ${BACKEND_WS_URL}...`);
    const ws = new WebSocket(BACKEND_WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected');
      reconnectCount.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>;

        // ── Backend error ──────────────────────────────────────────────────
        if (data.event === 'error') {
          console.error('[WS Backend Error]:', data.message);
          resetScene();
          resetWorkflow();
          clearTracking();
          return;
        }

        // ── Chat response ──────────────────────────────────────────────────
        if (data.event === 'scene_analysis_complete' && data.chat_reply) {
          handleChatResponse(data as unknown as SceneAnalysis & { chat_reply: string; chat_focus_target_id?: string });
          return;
        }

        // ── Normal scene analysis ──────────────────────────────────────────
        if (data.event !== 'scene_analysis_complete') return;

        if (!validateSceneAnalysis(data)) {
          console.warn('[WS] Malformed payload — skipping render', data);
          resetScene();
          resetWorkflow();
          clearTracking();
          return;
        }

        const analysis = data as unknown as SceneAnalysis;
        console.log('[WS] Analysis complete — hazards:', analysis.hazards?.length ?? 1);

        handleSceneAnalysis(analysis);

      } catch (err) {
        console.error('[WS] Error parsing message:', err);
        resetScene();
        resetWorkflow();
        clearTracking();
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
      reconnectCount.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = (e) => console.error('[WS] Error:', e);
    wsRef.current = ws;
  }, [resetScene, resetWorkflow, clearTracking]);

  // ── Scene analysis handler ─────────────────────────────────────────────────
  const handleSceneAnalysis = useCallback((analysis: SceneAnalysis) => {
    // 1. Update sceneStore (backwards-compat + V2.1 fields)
    setSceneAnalysis(analysis, currentBbox.current ?? []);

    // 2. Initialize AR tracking from VLM spatial_targets
    if (analysis.spatial_targets?.length > 0) {
      initFromVLM(analysis.spatial_targets);
    } else {
      clearTracking();
    }

    // 3. Update workflowStore with full hazards array
    const hazards = analysis.hazards ?? [];
    if (hazards.length > 0) {
      useWorkflowStore.getState().onHazardsDiscovered(hazards, analysis.selected_hazard_id);
    }

    // 4. Push spatial + guidance data
    const selectedHazard = (analysis.hazards ?? []).find(
      (h) => h.id === analysis.selected_hazard_id
    ) ?? analysis.hazards?.[0];

    useWorkflowStore.getState().setSpatialData(
      selectedHazard?.guidance ?? analysis.guidance ?? {},
      analysis.spatial_targets ?? [],
      analysis.general_solutions ?? [],
    );

    // 5. Auto-expand sheet based on risk
    const risk = analysis.risk_level ?? selectedHazard?.risk_level ?? 'LOW';
    const legacyHazard = useWorkflowStore.getState().selectedHazard;

    if (legacyHazard) {
      if (risk === 'CRITICAL' || risk === 'HIGH') {
        useWorkflowStore.getState().focusHazard(legacyHazard);
        useWorkflowStore.getState().openSheet();
        useUiStore.getState().setSheetPosition('full');
      } else {
        useWorkflowStore.getState().focusHazard(legacyHazard);
        useUiStore.getState().setSheetPosition('half');
      }
    }
  }, [setSceneAnalysis, initFromVLM, clearTracking]);

  // ── Chat response handler ──────────────────────────────────────────────────
  const handleChatResponse = useCallback((
    data: SceneAnalysis & { chat_reply: string; chat_focus_target_id?: string }
  ) => {
    // Update AR tracking so chat can spotlight the referenced target
    if (data.spatial_targets?.length > 0) {
      initFromVLM(data.spatial_targets);
    }
    if (data.chat_focus_target_id) {
      useARTrackingStore.getState().setChatFocusTarget(data.chat_focus_target_id);
    }
    // Add to chat history — triggers ChatBubble display
    const chatReply = data.chat_reply || data.summary || '';
    useChatStore.getState().addAssistantMessage(chatReply, data.chat_focus_target_id ?? null);
    useChatStore.getState().setTyping(false);
  }, [initFromVLM]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  // ── sendSceneFrame ─────────────────────────────────────────────────────────
  const sendSceneFrame = useCallback((full_frame_b64: string, hazard_focus_bbox: number[]) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send scene frame, WebSocket not open');
      return;
    }
    currentBbox.current = hazard_focus_bbox;

    wsRef.current.send(JSON.stringify({
      event: 'scene_frame_ready',
      session_id: 'demo_session_1',
      full_frame_b64,
      hazard_focus_bbox,
      device_context: {
        lighting: 'normal',
        motion: 'low',
        device_mode: 'live_camera',
      },
    }));
  }, []);

  // ── sendChatFrame ──────────────────────────────────────────────────────────
  // Phase 5: sends a text question + current camera frame to the backend.
  const sendChatFrame = useCallback((user_message: string, full_frame_b64: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send chat frame, WebSocket not open');
      return;
    }
    // Clear previous chat spotlight before sending
    useARTrackingStore.getState().setChatFocusTarget(null);

    wsRef.current.send(JSON.stringify({
      event: 'chat_frame_query',
      session_id: 'demo_session_1',
      full_frame_b64,
      user_message,
      conversation_history: [], // chatStore.history injected by AskAIButton in Phase 5
      device_context: {
        lighting: 'normal',
        motion: 'low',
        device_mode: 'chat',
      },
    }));
  }, []);

  return { sendSceneFrame, sendChatFrame };
}
