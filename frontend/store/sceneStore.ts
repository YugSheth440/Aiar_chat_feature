import { create } from 'zustand';
import type { SceneAnalysis, SceneHazard, SpatialTarget, AppState, RiskLevel } from '../src/types';

interface SceneState {
  // ── V2.1 multi-hazard fields ─────────────────────────────────────
  hazards: SceneHazard[];
  selected_hazard_id: string | null;
  general_solutions: string[];
  scene_id: string | null;

  // ── SRS §11.2 backwards-compat fields (derived from hazards[0]) ──
  primary_hazard: string | null;
  risk_level: RiskLevel | null;
  summary: string | null;
  spatial_targets: SpatialTarget[];
  fallback_plan: string | null;
  confidence: number;
  original_bbox: number[] | null;

  // ── Fallback UI state ─────────────────────────────────────────────
  fallbackMode: boolean;

  // ── Analysis status ───────────────────────────────────────────────
  analysisStatus: 'idle' | 'analyzing' | 'success' | 'timeout' | 'error';
  analysisSentAt: number | null;

  // ── Legacy (preserve for workflowStore compatibility) ────────────
  capsuleState: AppState;
  activeHazards: any[];
  arOverlays: any[];
  overallRisk: RiskLevel;

  // ── Actions ───────────────────────────────────────────────────────
  setSceneAnalysis: (data: SceneAnalysis, bbox: number[]) => void;
  markAnalysisSent: () => void;
  triggerFallbackMode: () => void;
  reset: () => void;
  setCapsuleState: (state: AppState) => void;
  setSceneData: (hazards: any[], overlays: any[], risk: RiskLevel) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  // V2.1 fields
  hazards: [],
  selected_hazard_id: null,
  general_solutions: [],
  scene_id: null,

  // Backwards-compat
  primary_hazard: null,
  risk_level: null,
  summary: null,
  spatial_targets: [],
  fallback_plan: null,
  confidence: 0,
  original_bbox: null,
  fallbackMode: false,

  analysisStatus: 'idle',
  analysisSentAt: null,

  capsuleState: 'ready',
  activeHazards: [],
  arOverlays: [],
  overallRisk: 'LOW',

  setSceneAnalysis: (data, bbox) => {
    // V2.1: use hazards[] if present; synthesise backwards-compat from hazards[0]
    const hazards = data.hazards ?? [];
    const topHazard = hazards[0];
    const topRisk: RiskLevel = topHazard?.risk_level ?? data.risk_level ?? 'LOW';

    set({
      // V2.1
      hazards,
      selected_hazard_id: data.selected_hazard_id ?? topHazard?.id ?? null,
      general_solutions: data.general_solutions ?? [],
      scene_id: data.scene_id ?? null,

      // Backwards-compat (synthesised or from legacy payload)
      primary_hazard: data.primary_hazard ?? topHazard?.title ?? null,
      risk_level: topRisk,
      summary: data.summary ?? topHazard?.summary ?? null,
      spatial_targets: data.spatial_targets ?? [],
      fallback_plan: data.fallback_plan ?? topHazard?.fallback_plan ?? null,
      confidence: data.confidence ?? topHazard?.confidence ?? 0,
      original_bbox: bbox,

      analysisStatus: 'success',
      fallbackMode: false,
      capsuleState: topRisk === 'CRITICAL' || topRisk === 'HIGH' ? 'critical' : 'guidance',
      overallRisk: topRisk,
    });
  },

  markAnalysisSent: () => set({
    analysisStatus: 'analyzing',
    analysisSentAt: Date.now(),
  }),

  triggerFallbackMode: () => set({ fallbackMode: true }),

  reset: () => set({
    hazards: [],
    selected_hazard_id: null,
    general_solutions: [],
    scene_id: null,
    primary_hazard: null,
    risk_level: null,
    summary: null,
    spatial_targets: [],
    fallback_plan: null,
    confidence: 0,
    original_bbox: null,
    fallbackMode: false,
    analysisStatus: 'idle',
    analysisSentAt: null,
    capsuleState: 'ready',
    activeHazards: [],
    arOverlays: [],
    overallRisk: 'LOW',
  }),

  setCapsuleState: (capsuleState) => set({ capsuleState }),
  setSceneData: (activeHazards, arOverlays, overallRisk) =>
    set({ activeHazards, arOverlays, overallRisk }),
}));
