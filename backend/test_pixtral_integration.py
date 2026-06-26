import os
import sys

# Make sure we can import detector
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from detector import HazardDetector

def run_tests():
    print("[*] Initializing HazardDetector...")
    detector = HazardDetector()

    mock_response = """
This image shows two individuals indoors, with one person holding a smartphone.

**Object Detection:**

1. **Person:**
 - Bounding box is from (0.05, 0.25) to (0.45, 0.65).
2. **Smartphone:**
 - Smartphone located from (0.45, 0.40) to (0.75, 0.85).

**Scene Understanding/Description:**
Two people standing indoors with a smartphone showing fire.

```json
{
  "detections": [
    {"label": "person", "box_2d": [0.05, 0.25, 0.45, 0.65]},
    {"label": "smartphone", "box_2d": [0.45, 0.40, 0.75, 0.85]},
    {"label": "fire", "box_2d": [0.50, 0.45, 0.70, 0.80]}
  ],
  "analysis": {
    "actions": ["Call emergency services", "Evacuate the area", "Extinguish flame if safe"],
    "priority": "high",
    "threat_level": "critical"
  }
}
```
"""
    width, height = 640, 480
    print("[*] Testing parse_pixtral_response...")
    detections, analysis = detector.parse_pixtral_response(mock_response, width, height)
    print(f"[+] Parsed {len(detections)} detections:")
    for det in detections:
        print(f"  - {det['label']}: {det['bbox']} (source: {det['source']})")
    print(f"[+] Parsed analysis: {analysis}")

    assert len(detections) == 3, f"Expected 3 detections, got {len(detections)}"
    assert detections[0]["label"] == "person"
    assert detections[0]["bbox"] == [32, 120, 288, 312] # 0.05*640, 0.25*480, 0.45*640, 0.65*480
    assert analysis["priority"] == "high"
    assert analysis["threat_level"] == "critical"

    print("[*] Testing clean_description...")
    cleaned = detector.clean_description(mock_response)
    print(f"[+] Cleaned caption:\n{cleaned}")
    assert "```json" not in cleaned, "JSON block was not stripped!"
    assert "**Object Detection:**" in cleaned, "Text content was incorrectly stripped!"

    print("[*] Testing logging pipeline...")
    # Clear test logs if any
    for file in [detector.csv_log_file, detector.detected_hazards_file, detector.non_hazards_file]:
        if os.path.exists(file):
            os.remove(file)

    # We need to map class IDs before appending
    for det in detections:
        lbl = det["label"]
        if lbl not in detector.names:
            detector.names[2000 + len(detector.names)] = lbl
        det["class"] = next(k for k, v in detector.names.items() if v == lbl)

    # Run appending
    detector.append_detections_to_csv(detections)

    assert os.path.exists(detector.csv_log_file), "detections_log.csv not created!"
    assert os.path.exists(detector.detected_hazards_file), "detected_hazards.csv not created!"
    assert os.path.exists(detector.non_hazards_file), "non_hazards.csv not created!"
    print("[+] Telemetry CSV logs created successfully.")

    # Read back to verify
    hazards = detector.load_csv_to_dict(detector.detected_hazards_file)
    non_hazards = detector.load_csv_to_dict(detector.non_hazards_file)
    print(f"[+] Detected Hazards: {list(hazards.keys())}")
    print(f"[+] Non Hazards: {list(non_hazards.keys())}")

    assert "fire" in hazards, "Fire should be logged as a hazard"
    assert "person" in non_hazards, "Person should be logged as a non-hazard"
    assert "smartphone" in non_hazards, "Smartphone should be logged as a non-hazard"

    print("\n[SUCCESS] All detector unit tests passed successfully!")

if __name__ == "__main__":
    run_tests()
