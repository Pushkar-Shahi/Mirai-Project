#!/usr/bin/env python3
"""Send a test WhatsApp message to verify connection.

Usage:
  python -m scripts.test_whatsapp --to "+919876543210" --text "Hello from Mirai!"
"""
import argparse
import asyncio
import os
import sys
import httpx
from workers.whatsapp import whatsapp_config

async def test_send(to: str, text: str):
    config = whatsapp_config()
    if not config:
        print("\n[ERROR] WhatsApp is not configured!")
        print("Please set either:")
        print("  1. WHATSAPP_BRIDGE_URL=http://127.0.0.1:3001 (for QR Linked Device)")
        print("  or")
        print("  2. WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, etc. (for Meta Cloud API)")
        sys.exit(1)

    print(f"\n[INFO] Mode: {config.get('mode', 'unknown').upper()}")
    print(f"[INFO] Target: {to}")
    print(f"[INFO] Message: {text}")

    if config.get("mode") == "bridge":
        print(f"[INFO] Sending via Bridge: {config['url']}...")
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.post(config["url"], json={"to": to, "message": text})
                if resp.is_success:
                    print(f"\n[SUCCESS] Message sent successfully! Result: {resp.json()}")
                else:
                    print(f"\n[FAILED] Server responded {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"\n[ERROR] Could not connect to bridge: {e}")
    else:
        print(f"[INFO] Sending via Meta Cloud API: {config['url']}...")
        # Meta template mode
        body = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": {
                "name": config["template"],
                "language": {"code": config["language"]},
                "components": [{
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": "Test Notification"},
                        {"type": "text", "text": text},
                    ],
                }],
            },
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.post(
                    config["url"], json=body,
                    headers={"Authorization": f"Bearer {config['token']}"},
                )
                if resp.is_success:
                    print(f"\n[SUCCESS] Message sent successfully! Result: {resp.json()}")
                else:
                    print(f"\n[FAILED] Meta API responded {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"\n[ERROR] Could not connect to Meta API: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test WhatsApp notification delivery")
    parser.add_argument("--to", required=True, help="Recipient phone number with country code (e.g. +919876543210)")
    parser.add_argument("--text", default="Test reminder from Mirai Tracker", help="Message text")
    args = parser.parse_args()

    asyncio.run(test_send(args.to, args.text))
