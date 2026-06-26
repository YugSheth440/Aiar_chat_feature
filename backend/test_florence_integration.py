import cv2
import numpy as np
from detector import HazardDetector

def run_test():
    print("[*] Initializing HazardDetector (Florence-2)...")
    detector = HazardDetector()
    
    # Create a simple blank image
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw a rectangle to act as a simulated object
    cv2.rectangle(img, (100, 100), (300, 300), (0, 255, 0), -1)
    
    # Encode as PNG bytes
    _, img_encoded = cv2.imencode('.png', img)
    img_bytes = img_encoded.tobytes()
    
    print("[*] Running detection...")
    detections, caption = detector.detect_image(img_bytes)
    print(f"[+] Detections result: {detections}")
    print(f"[+] Caption result: {caption}")
    print(f"[+] Active categories in detector: {detector.names}")
    print("[*] Test complete.")

if __name__ == "__main__":
    run_test()
