// ─── App State & Theme ───────────────────────────────────────
export type AppState = 'ready' | 'analyzing' | 'hazard' | 'guidance' | 'critical';
export type Theme    = 'operational' | 'critical';
export type SheetPos = 'collapsed' | 'half' | 'full';
export type ZoomLevel = '0.5x' | '1.0x' | '2.0x' | '5.0x';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NavTab = 'guide' | 'measure' | 'notes' | 'more';

// ─── AR Disclosure Level ────────────────────────────────────
// Controls the Progressive Disclosure system (V2.1).
// Gatekeeper for what every ARMarker renders.
export type ARDisclosureLevel =
  | 'DETECTION'      // L1: small hazard marker + compact label only
  | 'HAZARD_FOCUS'   // L2: selected hazard + 1 solution marker
  | 'STEP_GUIDANCE'  // L3: current hazard + current target + 1 connector
  | 'CHAT_FOCUS';    // L4: referenced object only, all others 10% opacity

// ─── Bounding Box ────────────────────────────────────────────
export interface BoundingBox {
  top: string;
  left: string;
  width: string;
  height: string;
}

// ─── Action Step ─────────────────────────────────────────────
export interface ActionStep {
  id: string;
  stepNumber: number;
  icon: string;          // lucide icon name
  title: string;
  subtitle?: string;
  isCritical: boolean;
  estimatedTime?: string;
  arAnchorId?: string;
}

// ─── Spatial Target ─────────────────────────────────────────
export type SpatialTargetType =
  | 'primary_hazard'
  | 'threat_multiplier'
  | 'mitigation_tool'
  | 'neutral_context';

export type MarkerType =
  | 'ring'
  | 'arrow'
  | 'pin'
  | 'warning_zone'
  | 'safe_zone'
  | 'tool_marker';

export interface SpatialTarget {
  id: string;
  // V2.1: links this marker to its parent hazard
  hazard_ref: string;
  label: string;
  type: SpatialTargetType;
  box_2d: [number, number, number, number]; // normalized [x1, y1, x2, y2]
  risk_level: RiskLevel;
  marker_type: MarkerType;
  step_reference?: string | null;
  // V2.1: depth estimate 0.0 (far) – 1.0 (close); drives 2.5D size scaling
  depth_hint: number;
  priority: number;
  guidance?: string;
}

// ─── Per-Hazard Guidance ─────────────────────────────────────
export interface HazardGuidance {
  problem: string;
  reason: string;
  why_it_matters: string;
  actions: ActionStep[];
}

// ─── Scene Hazard (V2.1 multi-hazard) ───────────────────────
// Replaces the flat primary_hazard string from V1.
export interface SceneHazard {
  id: string;                           // "haz_0", "haz_1", …
  title: string;
  risk_level: RiskLevel;
  summary: string;
  confidence: number;
  primary_box: [number, number, number, number]; // normalized [x1,y1,x2,y2]
  guidance: HazardGuidance;
  fallback_plan: string;
}

// ─── Scene Analysis (full V2.1 payload) ─────────────────────
export interface SceneAnalysis {
  event: 'scene_analysis_complete';
  scene_id: string;

  // V2.1 multi-hazard fields
  hazards: SceneHazard[];
  spatial_targets: SpatialTarget[];
  selected_hazard_id: string;
  general_solutions: string[];
  confidence: number;

  // ── Backwards-compat fields (synthesised from hazards[0] by backend) ──
  primary_hazard: string;
  risk_level: RiskLevel;
  summary: string;
  guidance?: HazardGuidance;
  fallback_plan: string;
}

// ─── Chat Analysis (Phase 5 extension) ──────────────────────
export interface ChatAnalysis extends SceneAnalysis {
  chat_reply: string;
  chat_focus_target_id: string | null;
}

// ─── Hazard (legacy UI shape — used by workflowStore / HazardSheet) ──
// Adapter converts SceneHazard → Hazard for existing components.
export interface Hazard {
  id: string;
  title: string;
  subtitle: string;
  riskLevel: RiskLevel;
  confidence: number;
  component: string;
  reading: string;
  readingUnit: string;
  description: string;
  reason: string;
  whyItMatters: string;
  tags: string[];
  boundingBox: BoundingBox;
  actions: ActionStep[];
}
