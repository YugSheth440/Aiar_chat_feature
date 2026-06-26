import type { SceneAnalysis, SceneHazard } from './types';

/**
 * Validates the V2.1 multi-hazard scene analysis payload from the backend.
 * The backend synthesises backwards-compat fields (primary_hazard, etc.),
 * so we check BOTH the new hazards[] array and the legacy flat fields.
 */
export function validateSceneAnalysis(data: unknown): data is SceneAnalysis {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  // Must have event tag
  if (d.event !== 'scene_analysis_complete') return false;

  // V2.1: prefer hazards[] validation
  if (Array.isArray(d.hazards) && d.hazards.length > 0) {
    return validateHazardsArray(d.hazards) && Array.isArray(d.spatial_targets);
  }

  // Backwards-compat: single-hazard shape (backend synthesised)
  return (
    typeof d.primary_hazard === 'string' &&
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(d.risk_level as string) &&
    typeof d.summary === 'string' &&
    Array.isArray(d.spatial_targets) &&
    typeof d.fallback_plan === 'string' &&
    typeof d.confidence === 'number'
  );
}

function validateHazardsArray(hazards: unknown[]): boolean {
  return hazards.every((h) => {
    if (!h || typeof h !== 'object') return false;
    const hz = h as Record<string, unknown>;
    return (
      typeof hz.id === 'string' &&
      typeof hz.title === 'string' &&
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(hz.risk_level as string) &&
      typeof hz.summary === 'string' &&
      typeof hz.confidence === 'number'
    );
  });
}

/**
 * Validates that a spatial_target has the required V2.1 fields.
 */
export function validateSpatialTarget(t: unknown): boolean {
  if (!t || typeof t !== 'object') return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.hazard_ref === 'string' &&
    typeof obj.label === 'string' &&
    Array.isArray(obj.box_2d) &&
    (obj.box_2d as unknown[]).length === 4
  );
}
