import urllib.request
import json
import base64
import time
from PIL import Image
import io

def generate_base64_image():
    # Generate a small 100x100 white JPEG image
    img = Image.new("RGB", (100, 100), color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def call_endpoint(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            latency = time.time() - start_time
            status = response.status
            res_data = response.read().decode("utf-8")
            res_json = json.loads(res_data)
            return status, latency, res_json, None
    except Exception as e:
        latency = time.time() - start_time
        return 500, latency, None, str(e)

def run_performance_test():
    base_url = "http://localhost:8000"
    img_b64 = generate_base64_image()
    
    endpoints = [
        {
            "name": "Identify Device",
            "path": "/identify-device",
            "payload": {
                "image_b64": img_b64,
                "device_context": {"lighting": "normal"}
            }
        },
        {
            "name": "Analyze Components",
            "path": "/analyze-components",
            "payload": {
                "image_b64": img_b64,
                "device": "AC Induction Motor",
                "device_context": {}
            }
        },
        {
            "name": "Troubleshoot Mode",
            "path": "/mode/troubleshoot",
            "payload": {
                "image_b64": img_b64,
                "device": "AC Induction Motor",
                "component_id": "cooling_fan",
                "issue": "overheating",
                "device_context": {}
            }
        },
        {
            "name": "Explain Mode",
            "path": "/mode/explain",
            "payload": {
                "image_b64": img_b64,
                "device": "AC Induction Motor",
                "component_id": "cooling_fan",
                "device_context": {}
            }
        },
        {
            "name": "Guide Mode",
            "path": "/mode/guide",
            "payload": {
                "image_b64": img_b64,
                "device": "AC Induction Motor",
                "component_id": "cooling_fan",
                "device_context": {}
            }
        }
    ]

    print("=" * 70)
    print("                FIXSIGHT API PERFORMANCE & CORRECTNESS TEST")
    print("=" * 70)
    print(f"Target Server: {base_url}")
    print("Generating base64 test frame...")
    print("Starting tests...\n")

    results = []
    
    for ep in endpoints:
        print(f"[*] Testing {ep['name']} ({ep['path']})...")
        status, latency, res_json, err = call_endpoint(base_url + ep["path"], ep["payload"])
        
        if status == 200 and res_json:
            print(f"    [+] Status: {status} | Latency: {latency:.2f}s")
            # Print brief summary depending on the endpoint type
            if "device" in res_json:
                print(f"    [+] Result: Device Identified -> {res_json['device']} (Confidence: {res_json.get('confidence')})")
            elif "components" in res_json:
                print(f"    [+] Result: {len(res_json['components'])} components found")
            elif "issue" in res_json:
                print(f"    [+] Result: Issue -> {res_json['issue']} | Actions Count -> {len(res_json.get('actions', []))}")
            elif "steps" in res_json:
                print(f"    [+] Result: {len(res_json['steps'])} guided steps returned")
            elif "title" in res_json:
                print(f"    [+] Result: Title -> {res_json['title']}")
            else:
                print(f"    [+] Result: JSON Keys -> {list(res_json.keys())}")
        else:
            print(f"    [x] Status: {status} | Latency: {latency:.2f}s | Error: {err}")
            
        results.append({
            "name": ep["name"],
            "path": ep["path"],
            "status": status,
            "latency": latency,
            "success": status == 200 and not err,
            "error": err
        })
        print("-" * 70)

    print("\n" + "=" * 70)
    print("                           SUMMARY REPORT")
    print("=" * 70)
    print(f"{'Endpoint Name':<25} | {'Path':<20} | {'Status':<6} | {'Latency':<8} | {'Result':<10}")
    print("-" * 70)
    
    all_success = True
    total_time = 0
    for r in results:
        status_str = str(r["status"])
        latency_str = f"{r['latency']:.2f}s"
        result_str = "SUCCESS" if r["success"] else "FAILED"
        if not r["success"]:
            all_success = False
        total_time += r["latency"]
        print(f"{r['name']:<25} | {r['path']:<20} | {status_str:<6} | {latency_str:<8} | {result_str:<10}")
        
    print("-" * 70)
    print(f"Total API Roundtrip Time: {total_time:.2f}s")
    print(f"Overall Status: {'PASSED' if all_success else 'FAILED'}")
    print("=" * 70)

if __name__ == "__main__":
    run_performance_test()
