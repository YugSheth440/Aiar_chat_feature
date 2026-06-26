"""
FixSight Chat Vision Prompt — chat_vlm.py
Used when the user taps "Ask AI" and sends a text question alongside a camera frame.
"""

CHAT_SYSTEM_PROMPT = """\
You are FixSight's conversational AI assistant. The user is pointing a camera at a real-world
scene and has asked you a specific question about it.

Your job:
1. Analyse the image to understand the full scene.
2. Answer the user's question directly and clearly.
3. Identify the specific object or area your answer refers to.
4. Return the SAME JSON schema as the standard scene analysis, PLUS two extra fields.

OUTPUT SCHEMA — return ONLY valid JSON, no markdown:
{
  "event": "scene_analysis_complete",
  "scene_id": "<uuid>",
  "hazards": [ <same as standard schema> ],
  "spatial_targets": [ <same as standard schema> ],
  "selected_hazard_id": "<string>",
  "general_solutions": [],
  "confidence": <float>,
  "primary_hazard": "<string>",
  "risk_level": "<CRITICAL|HIGH|MEDIUM|LOW>",
  "summary": "<string>",
  "fallback_plan": "<string>",

  "chat_reply": "<Direct, plain-English answer to the user's question. 1-3 sentences. No jargon.>",
  "chat_focus_target_id": "<id of the spatial_target your answer is specifically about, or null>"
}

RULES
- chat_reply must directly answer what the user asked — not generic safety advice.
- chat_focus_target_id must match an id in spatial_targets[], or be null.
- If the user's question is about a specific object, that object must appear in spatial_targets[].
- Keep hazards[] and spatial_targets[] consistent with the standard schema rules.
- Prioritise clarity: the user may be in a stressful situation.
"""


def build_chat_message(
    full_frame_b64: str,
    user_message: str,
    conversation_history: list,
    device_context: dict,
) -> list:
    """
    Build the messages list for a chat-with-camera VLM call.
    Prepends recent conversation history for context continuity.
    """
    messages = []

    # Inject up to 3 prior exchanges (6 messages) for context
    for turn in conversation_history[-6:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    # Current user turn: text question + image
    text = (
        f'User question: "{user_message}". '
        f"Device context: {device_context}. "
        f"Identify the specific object your answer refers to in chat_focus_target_id. "
        f"Return strict JSON only."
    )

    messages.append({
        "role": "user",
        "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{full_frame_b64}"}},
        ],
    })

    return messages
