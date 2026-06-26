import io
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForCausalLM

class FlorenceDetector:
    def __init__(self, model_id="microsoft/Florence-2-large"):
        """Initialize local Florence-2 model on CUDA or CPU."""
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        print(f"[Florence] Loading model {model_id} on {self.device}...")
        
        # Load processor and model
        self.processor = AutoProcessor.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, 
            trust_remote_code=True, 
            torch_dtype=self.torch_dtype
        ).to(self.device)

    def detect_and_caption(self, image_bytes: bytes) -> tuple[list, str]:
        """Perform object detection and detailed captioning on an image."""
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            width, height = image.size
        except Exception as e:
            print(f"[Florence] Error opening image bytes: {e}")
            return [], "Error loading image"

        # 1. Run caption task (<MORE_DETAILED_CAPTION>)
        caption_prompt = "<MORE_DETAILED_CAPTION>"
        caption_result = self._run_task(image, caption_prompt)
        caption = caption_result.get(caption_prompt, "No description available")

        # 2. Run object detection task (<OD>)
        od_prompt = "<OD>"
        od_result = self._run_task(image, od_prompt)
        parsed_od = od_result.get(od_prompt, {})
        
        # Format detections as list of dicts: {"label", "bbox", "source"}
        detections = []
        bboxes = parsed_od.get("bboxes", [])
        labels = parsed_od.get("labels", [])
        for bbox, label in zip(bboxes, labels):
            # Florence-2 returns bbox as [x1, y1, x2, y2]
            detections.append({
                "label": label,
                "bbox": [round(coord) for coord in bbox],
                "source": "florence"
            })
            
        return detections, caption

    def _run_task(self, image: Image.Image, task_prompt: str) -> dict:
        """Helper to run a specific Florence-2 prompt task."""
        inputs = self.processor(text=task_prompt, images=image, return_tensors="pt").to(self.device, self.torch_dtype)
        generated_ids = self.model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=1024,
            num_beams=3
        )
        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        return self.processor.post_process_generation(
            generated_text, 
            task=task_prompt, 
            image_size=image.size
        )
