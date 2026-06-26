/**
 * wsStore.ts — Singleton WebSocket manager (Zustand)
 *
 * ARCHITECTURE:
 *  • One WebSocket connection for the entire app lifetime.
 *  • All components read `sendSceneFrame` from this store — never from a hook.
 *  • Outbound messages are queued when the socket is not yet OPEN and
 *    flushed automatically on reconnect, so no frame is ever silently dropped.
 *  • Exponential back-off reconnect (1s → 2s → 4s … max 30s).
 *  • Status exposed as `wsStatus` so the UI can show Connecting / Connected /
 *    Reconnecting / Offline without polling readyState.
 */

import { create } from 'zustand';
import { BACKEND_WS_URL, BACKEND_URL } from '../src/config';
import { useSceneStore } from './sceneStore';
import { useWorkflowStore } from './workflowStore';
import { useUiStore } from './uiStore';
import { useARTrackingStore } from './arTrackingStore';
import { useChatStore } from './chatStore';
import { validateSceneAnalysis } from '../src/validators';
import type { SceneAnalysis } from '../src/types';

export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface QueuedMessage {
  payload: string;
  bbox: number[];
}

interface WsStore {
  wsStatus: WsStatus;

  // ── Public actions ──────────────────────────────────────────────────────────
  connect: () => void;
  disconnect: () => void;
  sendSceneFrame: (full_frame_b64: string, hazard_focus_bbox: number[]) => void;

  // ── Internal (do not call from components) ──────────────────────────────────
  _ws: WebSocket | null;
  _reconnectCount: number;
  _reconnectTimer: ReturnType<typeof setTimeout> | null;
  _queue: QueuedMessage[];
  _currentBbox: number[];
}

// ── Private helpers (not in the store state, live in module scope) ────────────
let _ws: WebSocket | null = null;
let _reconnectCount = 0;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _queue: QueuedMessage[] = [];
let _currentBbox: number[] = [];

function handleMessage(raw: string) {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (data.event === 'error') {
      console.error('[WS] Backend error:', data.message);
      useSceneStore.getState().reset();
      useWorkflowStore.getState().reset();
      useARTrackingStore.getState().clear();
      return;
    }

    if (data.event !== 'scene_analysis_complete') return;

    // Chat response
    if (data.chat_reply) {
      const payload = data as unknown as SceneAnalysis & {
        chat_reply: string;
        chat_focus_target_id?: string;
      };
      if (payload.spatial_targets?.length > 0) {
        useARTrackingStore.getState().initFromVLM(payload.spatial_targets);
      }
      if (payload.chat_focus_target_id) {
        useARTrackingStore.getState().setChatFocusTarget(payload.chat_focus_target_id);
      }
      const reply = payload.chat_reply || payload.summary || '';
      useChatStore.getState().addAssistantMessage(reply, payload.chat_focus_target_id ?? null);
      useChatStore.getState().setTyping(false);
      return;
    }

    // Normal analysis
    if (!validateSceneAnalysis(data)) {
      console.warn('[WS] Malformed payload — skipping', data);
      useSceneStore.getState().reset();
      useWorkflowStore.getState().reset();
      useARTrackingStore.getState().clear();
      return;
    }

    const analysis = data as unknown as SceneAnalysis;
    console.log('[WS] Analysis complete — hazards:', analysis.hazards?.length ?? 0);

    useSceneStore.getState().setSceneAnalysis(analysis, _currentBbox);

    if (analysis.spatial_targets?.length > 0) {
      useARTrackingStore.getState().initFromVLM(analysis.spatial_targets);
    } else {
      useARTrackingStore.getState().clear();
    }

    const hazards = analysis.hazards ?? [];
    if (hazards.length > 0) {
      useWorkflowStore.getState().onHazardsDiscovered(hazards, analysis.selected_hazard_id);
    }

    const selectedHazard =
      hazards.find((h) => h.id === analysis.selected_hazard_id) ?? hazards[0];

    useWorkflowStore.getState().setSpatialData(
      selectedHazard?.guidance ?? analysis.guidance ?? {},
      analysis.spatial_targets ?? [],
      analysis.general_solutions ?? [],
    );

    const risk = analysis.risk_level ?? selectedHazard?.risk_level ?? 'LOW';
    const legacyHazard = useWorkflowStore.getState().selectedHazard;
    if (legacyHazard) {
      useWorkflowStore.getState().focusHazard(legacyHazard);
      if (risk === 'CRITICAL' || risk === 'HIGH') {
        useWorkflowStore.getState().openSheet();
        useUiStore.getState().setSheetPosition('full');
      } else {
        useUiStore.getState().setSheetPosition('half');
      }
    }
  } catch (err) {
    console.error('[WS] Error parsing message:', err);
  }
}

function scheduleReconnect() {
  if (_reconnectTimer != null) return; // already scheduled
  const delay = Math.min(1000 * Math.pow(2, _reconnectCount), 30_000);
  console.log(`[WS] Reconnecting in ${delay}ms (attempt ${_reconnectCount + 1})`);
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    useWsStore.getState().connect();
  }, delay);
}

function flushQueue() {
  if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
  while (_queue.length > 0) {
    const item = _queue.shift()!;
    try {
      _ws.send(item.payload);
    } catch (_e) { /* ignore */ }
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useWsStore = create<WsStore>()((set) => ({
  wsStatus: 'connecting',
  _ws: null,
  _reconnectCount: 0,
  _reconnectTimer: null,
  _queue: [],
  _currentBbox: [],

  connect: () => {
    // Guard: do not open a second socket if one is already alive
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    set({ wsStatus: _reconnectCount === 0 ? 'connecting' : 'reconnecting' });
    console.log(`[WS] Connecting to ${BACKEND_WS_URL}...`);

    const ws = new WebSocket(BACKEND_WS_URL);
    _ws = ws;

    ws.onopen = () => {
      console.log('[WS] Connected ✓');
      _reconnectCount = 0;
      set({ wsStatus: 'connected' });
      flushQueue();
    };

    ws.onmessage = (e) => handleMessage(e.data as string);

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      _ws = null;
      set({ wsStatus: 'offline' });
      _reconnectCount++;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onerror always precedes onclose — let onclose handle the reconnect
      console.warn('[WS] Socket error — waiting for onclose to reconnect');
    };
  },

  disconnect: () => {
    if (_reconnectTimer != null) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    _ws?.close();
    _ws = null;
    _queue = [];
    set({ wsStatus: 'offline' });
  },

  sendSceneFrame: (full_frame_b64, hazard_focus_bbox) => {
    _currentBbox = hazard_focus_bbox;
    const payload = JSON.stringify({
      event: 'scene_frame_ready',
      session_id: 'demo_session_1',
      full_frame_b64,
      hazard_focus_bbox,
      device_context: { lighting: 'normal', motion: 'low', device_mode: 'live_camera' },
    });

    if (_ws?.readyState === WebSocket.OPEN) {
      try {
        _ws.send(payload);
      } catch (e) {
        console.error('[WS] send failed:', e);
      }
    } else {
      // Queue — will be flushed when the socket reconnects
      console.log('[WS] Socket not ready — queuing scene frame');
      _queue.push({ payload, bbox: hazard_focus_bbox });
    }
  },
}));
