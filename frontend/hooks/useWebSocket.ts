import { useEffect, useRef, useCallback } from 'react';
import { BACKEND_WS_URL } from '../src/config';
import { useSceneStore } from '../store/sceneStore';
import { useWorkflowStore } from '../store/workflowStore';
import { useUiStore } from '../store/uiStore';
import { validateSceneAnalysis } from '../src/validators';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const { setSceneAnalysis, reset: resetScene } = useSceneStore();
  const { reset: resetWorkflow } = useWorkflowStore();
  
  // Keep original bbox reference to pass to store
  const currentBbox = useRef<number[] | null>(null);

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
        const data = JSON.parse(e.data);
        if (data.event !== 'scene_analysis_complete') return;
        
        // Validate required fields before touching any store
        if (!validateSceneAnalysis(data)) {
          console.warn('[WS] Malformed payload — skipping render', data);
          resetScene();
          resetWorkflow(); // back to READY, not broken
          return;
        }

        // Pass validated data to UI state
        setSceneAnalysis(data, currentBbox.current || []);
        
        // Open the bottom sheet so the user can see the solutions!
        useUiStore.getState().setSheetPosition('half');
      } catch (err) {
        console.error('[WS] Error parsing message:', err);
        resetScene();
        resetWorkflow();
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      if (reconnectCount.current < 3) {
        reconnectCount.current++;
        console.log(`[WS] Reconnecting... (${reconnectCount.current}/3)`);
        setTimeout(connect, 2000);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Error:', e);
    };

    wsRef.current = ws;
  }, [resetScene, resetWorkflow, setSceneAnalysis]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendSceneFrame = useCallback((full_frame_b64: string, hazard_focus_bbox: number[]) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send scene frame, WebSocket not open');
      return;
    }

    currentBbox.current = hazard_focus_bbox;

    const payload = {
      event: "scene_frame_ready",
      session_id: "demo_session_1",
      full_frame_b64,
      hazard_focus_bbox,
      device_context: { 
        lighting: "normal", 
        motion: "low", 
        device_mode: "live_camera" 
      }
    };

    wsRef.current.send(JSON.stringify(payload));
  }, []);

  return { sendSceneFrame };
}
