// ─── App State & Theme ───────────────────────────────────────
export type AppState = 'ready' | 'analyzing' | 'hazard' | 'guidance' | 'critical';
export type Theme    = 'operational' | 'critical';
export type SheetPos = 'collapsed' | 'half' | 'full';
export type ZoomLevel = '0.5x' | '1.0x' | '2.0x' | '5.0x';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NavTab = 'guide' | 'measure' | 'notes' | 'more';

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
  subtitle: string;
  isCritical: boolean;
  estimatedTime?: string;
  arAnchorId?: string;
}

// ─── Spatial Target ─────────────────────────────────────────
export interface SpatialTarget {
  id: string;
  label: string;
  type: 'primary_hazard' | 'threat_multiplier' | 'mitigation_tool' | 'neutral_context';
  box_2d: [number, number, number, number]; // normalized [x1, y1, x2, y2]
  guidance: string;
}

// ─── Scene Analysis ─────────────────────────────────────────
export interface SceneAnalysis {
  event: 'scene_analysis_complete';
  primary_hazard: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  spatial_targets: SpatialTarget[];
  fallback_plan: string;
  confidence: number;
}

// ─── Hazard ──────────────────────────────────────────────────
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
