import os
import json
import uuid
import csv
import re
from dotenv import load_dotenv
from groq import Groq
from prompts.relational_vlm import SYSTEM_PROMPT

# Load environment variables on startup
load_dotenv(override=True)

class HazardDetector:
    def __init__(self):
        groq_key = os.getenv("GROQ_API_KEY")
        if not groq_key or groq_key == "your_key_here":
            raise EnvironmentError(
                "\n\n[FixSight] GROQ_API_KEY is not set or is still the placeholder value.\n"
                "Set it in backend/.env before starting the server.\n"
            )

        self.client = Groq(api_key=groq_key)
        self.llm_model = "llama-3.3-70b-versatile"
        self.vlm_model = "pixtral-12b-2409"
        
        # In-memory session state (SRS §16.1)
        self.sessions: dict[str, dict] = {}
        
        # File paths for tracking logs (expected by unit tests)
        self.csv_log_file = "detections_log.csv"
        self.detected_hazards_file = "detected_hazards.csv"
        self.non_hazards_file = "non_hazards.csv"
        
        # Category tracking maps (expected by unit tests)
        self.names = {0: "person", 1: "fire", 2: "smoke"}

    # ──────────────────────────────────────────────────────────────
    # Primary analysis — scan-driven (no user text)
    # ──────────────────────────────────────────────────────────────
    def analyze_scene(
        self,
        full_frame_b64: str,
        hazard_focus_bbox: list,
        session_id: str,
        device_context: dict,
    ) -> dict:
        """Analyse a camera frame using Pixtral-12B (VLM) + Llama 3.3 70B (LLM)."""
        try:
            jpeg_b64 = self._ensure_jpeg(full_frame_b64)
            
            # Step 1: Call VLM (Pixtral) to get scene understanding and object coordinate detection
            vlm_prompt = (
                "Analyze the image and provide a detailed visual description of the scene under the heading "
                "'**Scene Understanding/Description:**'. "
                "Identify all objects, hazards, tools, and people. Output a JSON block under the heading "
                "'**Object Detection:**' containing a key 'detections' which is a list of objects and "
                "their normalized 2D bounding boxes [x1, y1, x2, y2] (0.0 to 1.0 range)."
            )
            vlm_response = self._call_pixtral_vlm(jpeg_b64, vlm_prompt)
            
            # Extract detections for logging
            detections, _ = self.parse_pixtral_response(vlm_response, 640, 480)
            self.append_detections_to_csv(detections)

            # Step 2: Call LLM (Llama 3.3 70B) to reason over visual context and synthesize the final JSON scene graph
            llm_user_prompt = f"""
Visual scene analysis from VLM:
---
{vlm_response}
---
Device context: {device_context}.
Tracker hint box (normalized): {hazard_focus_bbox if hazard_focus_bbox else []}.

Synthesize a complete safety scene graph strictly conforming to the system prompt JSON schema.
Make sure you map the spatial target coordinates from the detections above, categorize threat levels, and construct detailed remediation steps.
"""
            llm_response = self._call_groq_llm(SYSTEM_PROMPT, llm_user_prompt)
            result = json.loads(llm_response)
            
            # Normalise response structures
            result["event"] = "scene_analysis_complete"
            if not result.get("scene_id"):
                result["scene_id"] = str(uuid.uuid4())
                
            # Backwards compatibility formatting
            if result.get("hazards") and len(result["hazards"]) > 0:
                top = result["hazards"][0]
                result.setdefault("primary_hazard", top.get("title", ""))
                result.setdefault("risk_level", top.get("risk_level", "LOW"))
                result.setdefault("summary", top.get("summary", ""))
                result.setdefault("fallback_plan", top.get("fallback_plan", ""))
                result.setdefault("confidence", top.get("confidence", 0.0))
                result.setdefault("guidance", top.get("guidance", {}))
                
            result.setdefault("spatial_targets", [])
            result.setdefault("hazards", [])
            result.setdefault("selected_hazard_id", None)
            result.setdefault("general_solutions", [])
            
            self.sessions[session_id] = {
                "last_hazards": [h.get("id") for h in result.get("hazards", [])],
                "last_risk": result.get("risk_level"),
                "last_scene_id": result.get("scene_id"),
            }
            
            return result
        except Exception as e:
            return self._fallback_response(str(e))

    # ──────────────────────────────────────────────────────────────
    # Chat analysis — user text + frame (Phase 5)
    # ──────────────────────────────────────────────────────────────
    def analyze_with_chat(
        self,
        full_frame_b64: str,
        user_message: str,
        session_id: str,
        device_context: dict,
        conversation_history: list | None = None,
    ) -> dict:
        """Analyse a camera frame in the context of user chat using Pixtral-12B + Llama 3.3 70B."""
        try:
            from prompts.chat_vlm import CHAT_SYSTEM_PROMPT

            jpeg_b64 = self._ensure_jpeg(full_frame_b64)
            history = conversation_history or []
            
            # Step 1: Call VLM (Pixtral) to analyze details relevant to the question
            vlm_prompt = (
                f"Analyze the image in the context of the user question: '{user_message}'. "
                "Provide a detailed description of the scene under the heading '**Scene Understanding/Description:**'. "
                "Identify all objects, hazards, tools, and people. Output a JSON block under the heading "
                "'**Object Detection:**' containing a key 'detections' which is a list of objects and "
                "their normalized 2D bounding boxes [x1, y1, x2, y2] (0.0 to 1.0 range)."
            )
            vlm_response = self._call_pixtral_vlm(jpeg_b64, vlm_prompt)

            # Step 2: Call LLM (Llama 3.3 70B) to reason over the chat history, VLM analysis, and output the response
            llm_user_prompt = f"""
Visual scene analysis from VLM:
---
{vlm_response}
---
User question: "{user_message}"
Conversation history: {history}
Device context: {device_context}.

Address the user question directly in the 'chat_reply' field (1-3 plain sentences) and fill out the complete safety graph schema. Map the target referred to by your answer in 'chat_focus_target_id'.
"""
            llm_response = self._call_groq_llm(CHAT_SYSTEM_PROMPT, llm_user_prompt)
            result = json.loads(llm_response)
            
            # Normalise response structures
            result["event"] = "scene_analysis_complete"
            if not result.get("scene_id"):
                result["scene_id"] = str(uuid.uuid4())

            # Backwards compatibility formatting
            if result.get("hazards") and len(result["hazards"]) > 0:
                top = result["hazards"][0]
                result.setdefault("primary_hazard", top.get("title", ""))
                result.setdefault("risk_level", top.get("risk_level", "LOW"))
                result.setdefault("summary", top.get("summary", ""))
                result.setdefault("fallback_plan", top.get("fallback_plan", ""))
                result.setdefault("confidence", top.get("confidence", 0.0))
                
            result.setdefault("spatial_targets", [])
            result.setdefault("hazards", [])
            result.setdefault("selected_hazard_id", None)
            result.setdefault("general_solutions", [])
            result.setdefault("chat_reply", "")
            result.setdefault("chat_focus_target_id", None)
            
            self.sessions[session_id] = {
                "last_hazards": [h.get("id") for h in result.get("hazards", [])],
                "last_chat_reply": result.get("chat_reply"),
            }
            return result
        except Exception as e:
            return self._fallback_response(str(e))

    # ──────────────────────────────────────────────────────────────
    # APIs for Local Florence Fallback / Unit Testing
    # ──────────────────────────────────────────────────────────────
    def detect_image(self, img_bytes: bytes) -> tuple[list, str]:
        """Routes call to Pixtral VLM, returning raw detections and caption (used by Florence integration)."""
        import base64
        from PIL import Image
        import io
        
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        
        # Call Pixtral
        vlm_prompt = (
            "Analyze the image. Provide a detailed visual description under the heading "
            "'**Scene Understanding/Description:**' and output a JSON block under the heading "
            "'**Object Detection:**' containing a key 'detections' which is a list of objects and "
            "their normalized 2D bounding boxes [x1, y1, x2, y2] (0.0 to 1.0 range)."
        )
        vlm_response = self._call_pixtral_vlm(img_b64, vlm_prompt)
        
        # Read dimensions from bytes
        try:
            img = Image.open(io.BytesIO(img_bytes))
            width, height = img.size
        except Exception:
            width, height = 640, 480
            
        detections, _ = self.parse_pixtral_response(vlm_response, width, height)
        caption = self.clean_description(vlm_response)
        return detections, caption

    def parse_pixtral_response(self, text: str, width: int, height: int) -> tuple[list, dict]:
        """Parses Pixtral VLM text output to extract detections and custom analysis fields (used by unit tests)."""
        detections = []
        analysis = {}
        
        # Locate JSON block
        json_match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                
                # Parse detections list
                for d in data.get("detections", []):
                    lbl = d.get("label", "object")
                    box_2d = d.get("box_2d", [0.0, 0.0, 0.0, 0.0])
                    # Denormalize normalized coordinates to absolute pixels
                    x1 = round(box_2d[0] * width)
                    y1 = round(box_2d[1] * height)
                    x2 = round(box_2d[2] * width)
                    y2 = round(box_2d[3] * height)
                    detections.append({
                        "label": lbl,
                        "bbox": [x1, y1, x2, y2],
                        "source": "pixtral"
                    })
                # Parse analysis dict
                analysis = data.get("analysis", {})
            except Exception as e:
                print(f"[Detector] parse_pixtral_response JSON decode failed: {e}")
                
        return detections, analysis

    def clean_description(self, text: str) -> str:
        """Removes code blocks to get the raw textual caption (used by unit tests)."""
        cleaned = re.sub(r"```json\s*(.*?)\s*```", "", text, flags=re.DOTALL)
        return cleaned.strip()

    def append_detections_to_csv(self, detections: list):
        """Logs detections to local CSV files for telemetry tracking (used by unit tests)."""
        fields = ["class", "label", "confidence", "x_min", "y_min", "x_max", "y_max"]
        
        # 1. Append to detections log
        file_exists = os.path.exists(self.csv_log_file)
        with open(self.csv_log_file, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            if not file_exists:
                writer.writeheader()
            for d in detections:
                bbox = d.get("bbox", [0, 0, 0, 0])
                writer.writerow({
                    "class": d.get("class", 0),
                    "label": d.get("label", ""),
                    "confidence": d.get("confidence", 0.9),
                    "x_min": bbox[0],
                    "y_min": bbox[1],
                    "x_max": bbox[2],
                    "y_max": bbox[3],
                })
                
        # 2. Separate hazards vs non-hazards
        hazard_fields = ["label", "confidence", "x_min", "y_min", "x_max", "y_max"]
        for d in detections:
            label = d.get("label", "").lower()
            bbox = d.get("bbox", [0, 0, 0, 0])
            is_hazard = any(h in label for h in ["fire", "smoke", "gas", "chemical", "wire", "leak", "spill", "hazard", "flame", "heat"])
            target_file = self.detected_hazards_file if is_hazard else self.non_hazards_file
            
            file_exists = os.path.exists(target_file)
            with open(target_file, mode="a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=hazard_fields)
                if not file_exists:
                    writer.writeheader()
                writer.writerow({
                    "label": d.get("label", ""),
                    "confidence": d.get("confidence", 0.9),
                    "x_min": bbox[0],
                    "y_min": bbox[1],
                    "x_max": bbox[2],
                    "y_max": bbox[3],
                })

    def load_csv_to_dict(self, filepath: str) -> dict:
        """Loads a logged CSV file and returns a label-keyed dictionary (used by unit tests)."""
        data = {}
        if os.path.exists(filepath):
            with open(filepath, mode="r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    lbl = row.get("label")
                    if lbl:
                        data[lbl] = row
        return data

    # ──────────────────────────────────────────────────────────────
    # Model Access Helpers
    # ──────────────────────────────────────────────────────────────
    def _call_pixtral_vlm(self, jpeg_b64: str, prompt: str) -> str:
        """Call Pixtral-12B via Mistral AI API (with Groq vision fallback)."""
        import urllib.request
        
        api_key = os.getenv("MISTRAL_API_KEY")
        if not api_key:
            # Fallback to Groq Vision API
            print("[Warning] MISTRAL_API_KEY not found in environment. Falling back to Groq Vision VLM.")
            try:
                response = self.client.chat.completions.create(
                    model="meta-llama/llama-4-scout-17b-16e-instruct",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{jpeg_b64}"}}
                            ]
                        }
                    ],
                    max_tokens=1024,
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"[Detector] Groq VLM fallback failed: {e}")
                raise EnvironmentError("MISTRAL_API_KEY is missing and Groq VLM fallback failed.")

        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        data = {
            "model": self.vlm_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{jpeg_b64}"}}
                    ]
                }
            ],
            "temperature": 0.2
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = response.read().decode("utf-8")
                res_json = json.loads(res_data)
                return res_json["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[Detector] Mistral API call failed: {e}")
            raise e

    def _call_groq_llm(self, system_prompt: str, user_prompt: str) -> str:
        """Call Llama 3.3 70B via Groq API."""
        response = self.client.chat.completions.create(
            model=self.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=2048
        )
        return response.choices[0].message.content

    def _ensure_jpeg(self, full_frame_b64: str) -> str:
        """Convert raw RGB bytes (320x320x3) to valid JPEG if needed.
        Also resizes large image inputs to a max dimension of 1024 to speed up VLM transfer and prevent timeouts."""
        try:
            import base64
            from PIL import Image
            import io

            raw_bytes = base64.b64decode(full_frame_b64)
            
            # Check if it is raw RGB bytes (320x320x3)
            if len(raw_bytes) == 320 * 320 * 3:
                img = Image.frombytes("RGB", (320, 320), raw_bytes)
            else:
                # Open the existing image format (JPEG/PNG/etc.)
                img = Image.open(io.BytesIO(raw_bytes))
            
            # Resize image if any dimension exceeds 1024
            max_size = 1024
            if img.width > max_size or img.height > max_size:
                ratio = min(max_size / img.width, max_size / img.height)
                new_width = int(img.width * ratio)
                new_height = int(img.height * ratio)
                try:
                    resample_filter = Image.Resampling.LANCZOS
                except AttributeError:
                    resample_filter = Image.LANCZOS
                img = img.resize((new_width, new_height), resample_filter)
            
            # Save as compressed JPEG
            jpeg_io = io.BytesIO()
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(jpeg_io, format="JPEG", quality=75)
            
            resized_b64 = base64.b64encode(jpeg_io.getvalue()).decode("utf-8")
            print(f"[Detector] Resized and compressed image from {len(full_frame_b64)} chars to {len(resized_b64)} chars.")
            return resized_b64
        except Exception as e:
            print(f"[Detector] Warning: _ensure_jpeg preprocessing failed: {e}")
            return full_frame_b64

    def _fallback_response(self, reason: str) -> dict:
        return {
            "event": "error",
            "message": f"Analysis unavailable: {reason}",
        }
