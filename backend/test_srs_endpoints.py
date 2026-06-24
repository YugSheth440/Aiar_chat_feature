import unittest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, MagicMock

class TestSRSEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("detector.HazardDetector._call_pixtral_vlm")
    @patch("detector.HazardDetector._call_groq_llm")
    def test_identify_device(self, mock_llm, mock_vlm):
        mock_vlm.return_value = "Visual description of AC Induction Motor"
        mock_llm.return_value = """{
            "device": "AC Induction Motor",
            "confidence": 0.94,
            "summary": "Detected correctly.",
            "confirmation_required": true,
            "title": "AC Induction Motor",
            "actions": ["Verify LOTO status", "Inspect electrical terminals"],
            "voice_text": "I identified this as an AC Induction Motor.",
            "ar_targets": []
        }"""
        
        response = self.client.post("/identify-device", json={
            "image": "mock_base64_string",
            "device_context": {"lighting": "normal"}
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Specific SRS requirements
        self.assertIn("device", data)
        self.assertIn("confidence", data)
        self.assertIn("summary", data)
        self.assertIn("confirmation_required", data)
        self.assertEqual(data["device"], "AC Induction Motor")
        self.assertEqual(data["confidence"], 0.94)
        self.assertTrue(data["confirmation_required"])
        
        # Standard JSON Response requirements
        self.assertIn("title", data)
        self.assertIn("actions", data)
        self.assertIn("voice_text", data)
        self.assertIn("ar_targets", data)

    @patch("detector.HazardDetector._call_pixtral_vlm")
    @patch("detector.HazardDetector._call_groq_llm")
    def test_analyze_components(self, mock_llm, mock_vlm):
        mock_vlm.return_value = "Detected terminal_box"
        mock_llm.return_value = """{
            "components": [
                {
                    "id": "terminal_box",
                    "name": "Terminal Box",
                    "label": "Terminal Box",
                    "bbox": [0.4, 0.2, 0.6, 0.3],
                    "box_2d": [0.4, 0.2, 0.6, 0.3],
                    "importance": 1,
                    "description": "Houses wire connections.",
                    "status": "Operational",
                    "statusType": "success"
                }
            ],
            "title": "Component Analysis",
            "summary": "Detected components for the Induction Motor.",
            "actions": ["Inspect terminal box wiring"],
            "voice_text": "I found a Terminal Box.",
            "ar_targets": ["terminal_box"]
        }"""
        
        response = self.client.post("/analyze-components", json={
            "image": "mock_base64_string",
            "device": "AC Induction Motor"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Specific SRS requirements
        self.assertIn("components", data)
        comp = data["components"][0]
        self.assertEqual(comp["id"], "terminal_box")
        self.assertEqual(comp["name"], "Terminal Box")
        self.assertEqual(comp["label"], "Terminal Box")
        self.assertEqual(comp["bbox"], [0.4, 0.2, 0.6, 0.3])
        self.assertEqual(comp["box_2d"], [0.4, 0.2, 0.6, 0.3])
        self.assertEqual(comp["importance"], 1)
        
        # Standard JSON Response requirements
        self.assertIn("title", data)
        self.assertIn("summary", data)
        self.assertIn("actions", data)
        self.assertIn("voice_text", data)
        self.assertIn("ar_targets", data)

    @patch("detector.HazardDetector._call_pixtral_vlm")
    @patch("detector.HazardDetector._call_groq_llm")
    def test_troubleshoot(self, mock_llm, mock_vlm):
        mock_vlm.return_value = "Overheating issue detected"
        mock_llm.return_value = """{
            "issue": "Overheating",
            "possible_causes": ["Blocked cooling fan", "Bearing friction"],
            "related_components": ["cooling_fan", "bearing"],
            "title": "Troubleshooting: Overheating",
            "summary": "Suspected blocked cooling fan or bearing friction.",
            "actions": ["Inspect cooling fan blades", "Check bearing lubrication"],
            "voice_text": "Suspected overheating issue. Causes include blocked cooling fan or bearing friction.",
            "ar_targets": ["cooling_fan", "bearing"]
        }"""
        
        # Test input payload using "question" parameter as requested by user
        response = self.client.post("/mode/troubleshoot", json={
            "device": "AC Induction Motor",
            "question": "Motor overheating"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Specific SRS requirements
        self.assertIn("issue", data)
        self.assertIn("possible_causes", data)
        self.assertIn("related_components", data)
        self.assertEqual(data["issue"], "Overheating")
        self.assertEqual(data["possible_causes"], ["Blocked cooling fan", "Bearing friction"])
        self.assertEqual(data["related_components"], ["cooling_fan", "bearing"])
        
        # Standard JSON Response requirements
        self.assertIn("title", data)
        self.assertIn("summary", data)
        self.assertIn("actions", data)
        self.assertIn("voice_text", data)
        self.assertIn("ar_targets", data)

    @patch("detector.HazardDetector._call_pixtral_vlm")
    @patch("detector.HazardDetector._call_groq_llm")
    def test_explain(self, mock_llm, mock_vlm):
        mock_vlm.return_value = "Visual explanation details"
        mock_llm.return_value = """{
            "title": "Terminal Box",
            "summary": "Contains electrical connections.",
            "note": "Check wiring if power issues occur.",
            "actions": ["Visual check"],
            "voice_text": "The terminal box protects electrical wiring.",
            "ar_targets": ["terminal_box"]
        }"""
        
        # Test input payload using "component" parameter as requested by user
        response = self.client.post("/mode/explain", json={
            "component": "terminal_box"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Specific SRS requirements
        self.assertIn("title", data)
        self.assertIn("summary", data)
        self.assertIn("note", data)
        self.assertEqual(data["title"], "Terminal Box")
        self.assertEqual(data["summary"], "Contains electrical connections.")
        self.assertEqual(data["note"], "Check wiring if power issues occur.")
        
        # Standard JSON Response requirements
        self.assertIn("actions", data)
        self.assertIn("voice_text", data)
        self.assertIn("ar_targets", data)

    @patch("detector.HazardDetector._call_pixtral_vlm")
    @patch("detector.HazardDetector._call_groq_llm")
    def test_guide(self, mock_llm, mock_vlm):
        mock_vlm.return_value = "Guide layout description"
        mock_llm.return_value = """{
            "steps": [
                {
                    "id": "step_1",
                    "stepNumber": 1,
                    "title": "Inspect fan",
                    "instruction": "Inspect fan blades.",
                    "description": "Inspect fan blades.",
                    "target": "cooling_fan",
                    "componentId": "cooling_fan"
                }
            ],
            "title": "Safety Guide",
            "summary": "Procedure to safely inspect cooling fan.",
            "actions": ["LOTO main switch"],
            "voice_text": "Please inspect the cooling fan blades.",
            "ar_targets": ["cooling_fan"]
        }"""
        
        response = self.client.post("/mode/guide", json={
            "device": "AC Induction Motor",
            "component_id": "cooling_fan"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Specific SRS requirements
        self.assertIn("steps", data)
        step = data["steps"][0]
        self.assertEqual(step["id"], "step_1")
        self.assertEqual(step["target"], "cooling_fan")
        self.assertEqual(step["componentId"], "cooling_fan")
        self.assertEqual(step["instruction"], "Inspect fan blades.")
        self.assertEqual(step["description"], "Inspect fan blades.")
        
        # Standard JSON Response requirements
        self.assertIn("title", data)
        self.assertIn("summary", data)
        self.assertIn("actions", data)
        self.assertIn("voice_text", data)
        self.assertIn("ar_targets", data)

if __name__ == "__main__":
    unittest.main()
