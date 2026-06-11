import os
import json
from groq import Groq
from prompts.relational_vlm import SYSTEM_PROMPT, build_user_message

class HazardDetector:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")

        # Startup guard: fail loudly with a clear message instead of a
        # cryptic GroqError deep in the import chain.
        if not api_key or api_key == "your_key_here":
            raise EnvironmentError(
                "\n\n[FixSight] GROQ_API_KEY is not set or is still the placeholder value.\n"
                "Set it in backend/.env before starting the server:\n"
                "  GROQ_API_KEY=gsk_...\n"
            )

        self.client = Groq(api_key=api_key)
        # Model loaded from .env — swap without touching code
        self.model = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
        # Lightweight in-memory session state (SRS §16.1)
        self.sessions: dict[str, dict] = {}

    def analyze_scene(
        self,
        full_frame_b64: str,
        hazard_focus_bbox: list,
        session_id: str,
        device_context: dict,
    ) -> dict:
        try:
            import base64
            from PIL import Image
            import io
            
            # The app sends raw RGB bytes (640x640) encoded in base64.
            # We must convert this to a valid JPEG for the Groq Vision model.
            try:
                raw_bytes = base64.b64decode(full_frame_b64)
                if len(raw_bytes) == 640 * 640 * 3:
                    img = Image.frombytes("RGB", (640, 640), raw_bytes)
                    jpeg_io = io.BytesIO()
                    img.save(jpeg_io, format="JPEG", quality=80)
                    valid_jpeg_b64 = base64.b64encode(jpeg_io.getvalue()).decode("utf-8")
                else:
                    valid_jpeg_b64 = full_frame_b64
            except Exception:
                valid_jpeg_b64 = full_frame_b64

            response = self.client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": build_user_message(
                            valid_jpeg_b64, hazard_focus_bbox, device_context
                        ),
                    },
                ],
                max_tokens=1024,
            )
            result = json.loads(response.choices[0].message.content)
            result["event"] = "scene_analysis_complete"

            self.sessions[session_id] = {
                "last_hazard": result.get("primary_hazard"),
                "last_risk": result.get("risk_level"),
            }
            return result
        except Exception as e:
            return self._fallback_response(str(e))

    def _fallback_response(self, reason: str) -> dict:
        return {
            "event": "scene_analysis_complete",
            "primary_hazard": "Unknown",
            "risk_level": "LOW",
            "summary": f"Analysis unavailable: {reason}",
            "spatial_targets": [],
            "fallback_plan": "Move to a safe area and alert others.",
            "confidence": 0.0,
        }
