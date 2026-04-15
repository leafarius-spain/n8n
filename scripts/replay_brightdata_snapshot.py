#!/usr/bin/env python3
"""Replay a saved Bright Data snapshot JSON into the n8n ingest webhook.

Usage:
  python3 scripts/replay_brightdata_snapshot.py \
    --file antiguos/brightdata/sd_mnt9v2vl2jkn64i4yr.json
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_WEBHOOK = "https://ingesta.sistechvision.online/webhook/social/brightdata/facebook"
DEFAULT_FALLBACK_WEBHOOK = "http://192.168.0.50:5678/webhook/social/brightdata/facebook"


def chunked(items: List[Any], size: int) -> List[List[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def post_json(url: str, payload: Any, timeout: int) -> tuple[int, str]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            # Public ingress may enforce bot checks; this avoids naive filters.
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) replay-brightdata/1.0",
            "Accept": "application/json, text/plain, */*",
        },
        method="POST",
    )
    with urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return int(resp.status), body


def is_cf_1010(status: int, body: str) -> bool:
    text = (body or "").lower()
    return status == 403 and ("1010" in text or "access denied" in text)


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay a Bright Data snapshot JSON into ingest webhook")
    parser.add_argument("--file", required=True, help="Path to snapshot JSON file")
    parser.add_argument("--webhook", default=DEFAULT_WEBHOOK, help="Target ingest webhook URL")
    parser.add_argument(
        "--fallback-webhook",
        default=DEFAULT_FALLBACK_WEBHOOK,
        help="Fallback webhook URL when public ingress blocks with 403/1010",
    )
    parser.add_argument("--batch-size", type=int, default=250, help="Posts per HTTP request")
    parser.add_argument("--timeout", type=int, default=60, help="HTTP timeout per request (seconds)")
    parser.add_argument("--sleep-ms", type=int, default=0, help="Delay between batches")
    parser.add_argument("--dry-run", action="store_true", help="Validate file and print stats only")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"ERROR: file not found: {path}")
        return 1

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"ERROR: invalid JSON: {exc}")
        return 1

    if not isinstance(payload, list):
        print("ERROR: snapshot JSON must be a top-level array")
        return 1

    total = len(payload)
    if total == 0:
        print("ERROR: snapshot has 0 items")
        return 1

    sample_keys = sorted(list(payload[0].keys()))[:12] if isinstance(payload[0], dict) else []
    print(f"Loaded {total} posts from {path}")
    print(f"Batch size: {args.batch_size} -> {((total - 1) // args.batch_size) + 1} request(s)")
    if sample_keys:
        print("Sample keys:", ", ".join(sample_keys))

    if args.dry_run:
        print("Dry run completed. Nothing sent.")
        return 0

    batches = chunked(payload, args.batch_size)
    sent = 0
    current_webhook = args.webhook
    used_fallback = False

    for idx, batch in enumerate(batches, start=1):
        try:
            status, body = post_json(current_webhook, batch, timeout=args.timeout)
        except HTTPError as exc:
            text = exc.read().decode("utf-8", errors="replace")
            if (
                not used_fallback
                and args.fallback_webhook
                and current_webhook != args.fallback_webhook
                and is_cf_1010(exc.code, text)
            ):
                print(
                    "WARN: public ingress blocked with 403/1010. "
                    f"Retrying batch {idx} via fallback {args.fallback_webhook}"
                )
                current_webhook = args.fallback_webhook
                used_fallback = True
                try:
                    status, body = post_json(current_webhook, batch, timeout=args.timeout)
                except HTTPError as exc2:
                    text2 = exc2.read().decode("utf-8", errors="replace")
                    print(f"ERROR batch {idx}/{len(batches)} HTTP {exc2.code}: {text2[:800]}")
                    return 1
                except URLError as exc2:
                    print(f"ERROR batch {idx}/{len(batches)} network: {exc2}")
                    return 1
                except Exception as exc2:
                    print(f"ERROR batch {idx}/{len(batches)} unexpected: {exc2}")
                    return 1
            else:
                print(f"ERROR batch {idx}/{len(batches)} HTTP {exc.code}: {text[:800]}")
                if is_cf_1010(exc.code, text):
                    print(
                        "Hint: pass --webhook http://192.168.0.50:5678/webhook/social/brightdata/facebook "
                        "or set --fallback-webhook to your internal n8n URL."
                    )
                return 1
        except URLError as exc:
            print(f"ERROR batch {idx}/{len(batches)} network: {exc}")
            return 1
        except Exception as exc:
            print(f"ERROR batch {idx}/{len(batches)} unexpected: {exc}")
            return 1

        sent += len(batch)
        print(
            f"OK batch {idx}/{len(batches)}: sent={len(batch)} total_sent={sent} "
            f"status={status} target={current_webhook} body={body[:200]}"
        )

        if args.sleep_ms > 0 and idx < len(batches):
            time.sleep(args.sleep_ms / 1000.0)

    print(f"Replay finished: {sent}/{total} posts sent to {current_webhook}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
