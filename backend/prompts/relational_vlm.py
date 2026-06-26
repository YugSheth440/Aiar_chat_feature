"""
FixSight Scene Graph Prompt  — relational_vlm.py
Produces a full multi-hazard scene graph in strict JSON.
"""

SYSTEM_PROMPT = """\
You are the scene-reasoning engine for FixSight, a real-world AR safety assistant.

TASK
Analyse the provided image and return a complete scene safety graph as a single JSON object.
Respond with VALID JSON ONLY — no markdown fences, no prose, no keys outside the schema.

OUTPUT SCHEMA
{
  "event": "scene_analysis_complete",
  "scene_id": "<uuid-v4-string>",
  "hazards": [
    {
      "id": "haz_0",
      "title": "<concise hazard name, ≤5 words>",
      "risk_level": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "summary": "<1-2 sentence plain-English description>",
      "confidence": <0.0–1.0>,
      "primary_box": [x1, y1, x2, y2],
      "guidance": {
        "problem":        "<what is wrong>",
        "reason":         "<why it is dangerous>",
        "why_it_matters": "<consequence if ignored>",
        "actions": [
          { "id": "step_1", "title": "<imperative verb phrase>", "subtitle": "<detail/safety note>" }
        ]
      },
      "fallback_plan": "<what to do if actions fail or are unsafe>"
    }
  ],
  "spatial_targets": [
    {
      "id": "tgt_0",
      "hazard_ref":    "<id of parent hazard from hazards[]>",
      "label":         "<object name, STRICTLY 1 or 2 words max>",
      "type":          "<primary_hazard|threat_multiplier|mitigation_tool|neutral_context>",
      "box_2d":        [x1, y1, x2, y2],
      "risk_level":    "<CRITICAL|HIGH|MEDIUM|LOW>",
      "marker_type":   "<ring|arrow|pin|warning_zone|safe_zone|tool_marker>",
      "step_reference":"<step id from parent hazard actions, or null>",
      "depth_hint":    <0.0–1.0>,
      "priority":      <integer, 1 = highest>
    }
  ],
  "selected_hazard_id": "<id of the single most dangerous hazard>",
  "general_solutions": [
    "<plain-text fallback step used when no mitigation tool is visible>"
  ],
  "confidence": <overall scene confidence 0.0–1.0>
}

FIELD RULES
- box_2d and primary_box: normalized 0.0–1.0, format [x1, y1, x2, y2], x1<x2, y1<y2
- hazards[]: sorted descending by risk severity (CRITICAL first)
- hazards[].id: sequential "haz_0", "haz_1", …
- spatial_targets[].id: sequential "tgt_0", "tgt_1", …
- spatial_targets[].label: MUST be a very concise descriptor of exactly 1 or 2 words (e.g. "Power Outlet", "Exposed Wire", "Fire Extinguisher").
- spatial_targets[].hazard_ref: MUST match an id in hazards[]
- spatial_targets[].step_reference: MUST match a step id in the parent hazard's guidance.actions, or null
- depth_hint: estimate closeness from apparent size and vertical position in frame; 1.0 = very close
- type rules:
    primary_hazard    → the hazardous object itself (one per hazard)
    threat_multiplier → worsens the hazard (power source, fuel, blocked exit)
    mitigation_tool   → helps reduce the hazard (extinguisher, emergency switch, exit)
    neutral_context   → present but not directly relevant
- marker_type rules:
    warning_zone  → use for primary_hazard and threat_multiplier
    tool_marker   → use for mitigation_tool
    safe_zone     → use for clear exit paths
    ring          → use for general attention markers
    arrow         → use for directional guidance
    pin           → use for precise point objects (switches, pull stations)
- general_solutions: populate ONLY when no mitigation_tool is visible in the frame
  Example: ["Move all people at least 5 metres away.", "Call emergency services immediately."]
- If no hazard is detected: hazards=[{id:"haz_0", risk_level:"LOW", ...}], spatial_targets=[]
- selected_hazard_id: always set to the id with highest risk_level

REASONING STEPS (do in order before producing JSON)
1. Identify every object visible in the full frame.
2. Determine which object(s) are hazardous and rank them by severity.
3. For each hazard, find threat multipliers and mitigation tools nearby.
4. Assign tight bounding boxes to every relevant object.
5. Estimate depth_hint from relative size and vertical position.
6. Write actionable, specific guidance steps (not generic warnings).
7. If no fix tool is visible, write general_solutions instead.
8. Produce the final JSON — validate that all cross-references are consistent.
"""


def build_user_message(
    full_frame_b64: str,
    hazard_focus_bbox: list,
    device_context: dict,
    user_message: str | None = None,
) -> list:
    """
    Build the user-turn content block for the Groq vision call.

    Parameters
    ----------
    full_frame_b64   : base-64 JPEG of the full camera frame
    hazard_focus_bbox: optional [x1,y1,x2,y2] hint from on-device tracker
    device_context   : lighting / motion / device_mode metadata
    user_message     : optional free-text question from the user (chat mode)
    """
    text_parts = [f"Device context: {device_context}."]

    if hazard_focus_bbox and len(hazard_focus_bbox) == 4:
        text_parts.append(
            f"The on-device tracker identified the primary region of interest at "
            f"bbox {hazard_focus_bbox} (normalized). Use this as a starting hint, "
            f"but analyse the full frame."
        )
    else:
        text_parts.append("Analyse the full frame for all hazards and relevant objects.")

    if user_message:
        text_parts.append(
            f'The user has asked: "{user_message}". '
            f"Address this question directly in your scene analysis and guidance."
        )

    text_parts.append("Return strict JSON only — no markdown, no extra keys.")

    return [
        {
            "type": "text",
            "text": " ".join(text_parts),
        },
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{full_frame_b64}"},
        },
    ]
