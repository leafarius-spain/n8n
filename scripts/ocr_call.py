#!/usr/bin/env python3
"""
OCR helper script for n8n executeCommand node.
Usage: python3 ocr_call.py <storage_path> <media_id> <social_post_id>
Output (one field per line):
  line 0: media_id
  line 1: social_post_id
  line 2: storage_path
  line 3: OK | FAIL
  line 4: OCR JSON result or error JSON
"""
import sys
import base64
import json
import urllib.request

OCR_URL = "http://127.0.0.1:5000/predict"
TIMEOUT = 30

def main():
    if len(sys.argv) < 4:
        print("USAGE_ERROR", flush=True)
        sys.exit(1)

    storage_path = sys.argv[1]
    media_id = sys.argv[2]
    social_post_id = sys.argv[3]

    print(media_id)
    print(social_post_id)
    print(storage_path)

    try:
        with open(storage_path, "rb") as f:
            image_bytes = f.read()

        b64 = base64.b64encode(image_bytes).decode("ascii")
        payload = json.dumps({"image": b64}).encode("utf-8")
        req = urllib.request.Request(OCR_URL, payload, {"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, timeout=TIMEOUT)
        ocr_raw = resp.read().decode("utf-8")
        # Validate it's JSON
        json.loads(ocr_raw)
        print("OK")
        print(ocr_raw)
    except Exception as exc:
        print("FAIL")
        print(json.dumps({"OCR_LEN": 0, "OCR_RAW": "", "OCR_SCORE": 0, "resultado": [], "error": str(exc)}))

if __name__ == "__main__":
    main()
