#!/usr/bin/env python3
"""Deploy the Dr Squeegee after-hours assistant to Vapi (Python twin of deploy.sh; no jq needed).

Idempotent: tools are matched by function name, the assistant by name, the phone number by
E.164 -- existing objects are PATCHed, missing ones created. Re-run after editing
tools.json / assistant.json / system-prompt.md.

    export VAPI_PRIVATE_KEY=...      # Vapi dashboard -> API Keys -> Private
    export VAPI_SERVER_SECRET=...    # value of the n8n "Vapi Tool Secret" credential
    export VAPI_VOICE_ID=...         # Cartesia voice id (assistant.json ships a placeholder)
    export VAPI_PHONE_NUMBER=+1...   # optional: the Vapi-held number to point at the assistant
    python deploy.py                 # prints the assistant id on stdout, everything else on stderr

The committed JSONs are never rewritten -- secrets and the voice id are injected into
working copies only (validate.py refuses real secrets in tracked files).
"""
import copy
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://api.vapi.ai"


def log(msg):
    print(msg, file=sys.stderr)


def api(method, path, body=None):
    key = os.environ.get("VAPI_PRIVATE_KEY")
    if not key:
        sys.exit("VAPI_PRIVATE_KEY is not set")
    req = urllib.request.Request(
        API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        # api.vapi.ai sits behind Cloudflare, which rejects Python's default User-Agent (error 1010)
        headers={"Authorization": f"Bearer {key}", "content-type": "application/json",
                 "User-Agent": "curl/8.0 (dr-squeegee voice-agent deploy)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> HTTP {e.code}: {e.read().decode(errors='replace')[:1500]}")


def with_secret(obj, secret):
    obj = copy.deepcopy(obj)
    if secret and "server" in obj and "headers" in obj["server"]:
        obj["server"]["headers"]["x-vapi-secret"] = secret
    return obj


def main():
    secret = os.environ.get("VAPI_SERVER_SECRET")
    voice_id = os.environ.get("VAPI_VOICE_ID")
    phone = os.environ.get("VAPI_PHONE_NUMBER")
    if not secret:
        log("WARNING: VAPI_SERVER_SECRET unset -- tools will carry the placeholder header and 403 against n8n")
    if not voice_id:
        log("WARNING: VAPI_VOICE_ID unset -- assistant.json's placeholder voiceId will be rejected by Vapi")

    tools = json.loads((HERE / "tools.json").read_text(encoding="utf-8"))
    assistant = json.loads((HERE / "assistant.json").read_text(encoding="utf-8"))
    prompt = (HERE / "system-prompt.md").read_text(encoding="utf-8")
    if assistant["model"]["messages"][0]["content"] != prompt:
        sys.exit("assistant.json's system prompt is out of sync with system-prompt.md (run validate.py)")

    # ---- tools: upsert by function name
    live_tools = {t.get("function", {}).get("name"): t for t in api("GET", "/tool?limit=1000")}
    tool_ids = []
    for t in tools:
        name = t["function"]["name"]
        body = with_secret(t, secret)
        if name in live_tools:
            tid = live_tools[name]["id"]
            body.pop("type", None)  # type is immutable on PATCH
            api("PATCH", f"/tool/{tid}", body)
            log(f"  updated tool {name:20} {tid}")
        else:
            tid = api("POST", "/tool", body)["id"]
            log(f"  created tool {name:20} {tid}")
        tool_ids.append(tid)

    # ---- assistant: upsert by name
    body = with_secret(assistant, secret)
    body["model"]["toolIds"] = tool_ids
    if voice_id:
        body["voice"]["voiceId"] = voice_id
    live = [a for a in api("GET", "/assistant?limit=1000") if a.get("name") == assistant["name"]]
    if live:
        aid = live[0]["id"]
        api("PATCH", f"/assistant/{aid}", body)
        log(f"  updated assistant {aid}")
    else:
        aid = api("POST", "/assistant", body)["id"]
        log(f"  created assistant {aid}")

    # ---- phone number: point it at the assistant
    if phone:
        nums = [n for n in api("GET", "/phone-number") if n.get("number") == phone]
        if not nums:
            sys.exit(f"phone number {phone} not found in this Vapi org")
        api("PATCH", f"/phone-number/{nums[0]['id']}", {"assistantId": aid})
        log(f"  {phone} -> assistant {aid}")

    print(aid)


if __name__ == "__main__":
    main()
