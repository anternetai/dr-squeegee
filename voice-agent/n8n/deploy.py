#!/usr/bin/env python3
"""Deploy the six vapi-*.json workflows to the live n8n instance through its public API.

Idempotent: a workflow whose name already exists is updated in place (PUT) and re-activated,
so re-running after editing a JSON is the normal way to ship a change. Nothing here touches
credentials — those are created once in n8n and referenced by id inside the JSONs.

    export N8N_API_KEY=...                       # n8n -> Settings -> n8n API
    export TWILIO_ACCOUNT_SID=... TWILIO_MESSAGING_SERVICE_SID=...   # from .env.local; injected into the SMS nodes
    python deploy.py                             # deploy + activate all six
    python deploy.py --dry-run        # show what would happen
    python deploy.py --only vapi-quote-service.json

Credential ids expected by the JSONs (live as of 2026-09-08):
    Vapi Tool Secret (httpHeaderAuth, header x-vapi-secret)   wycoqjtM2qevxil3
    Twilio API Key (Dr Squeegee AC1ee98) (httpBasicAuth)     Sm4NXmuBaNMtJ9WN
    Supabase Database (postgres)                              WJrBNk44uOAqNA1S
    Slack Bearer Token (httpBearerAuth)                       28t8r7NccDmq8NVt
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = os.environ.get("N8N_API_URL", "https://n8n-production-1286.up.railway.app").rstrip("/")
HERE = Path(__file__).resolve().parent


def api(method, path, body=None):
    key = os.environ.get("N8N_API_KEY")
    if not key:
        sys.exit("N8N_API_KEY is not set")
    req = urllib.request.Request(
        f"{BASE}/api/v1{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"X-N8N-API-KEY": key, "content-type": "application/json", "accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path} -> HTTP {e.code}: {e.read().decode(errors='replace')[:800]}")


def existing_by_name():
    out, cursor = {}, None
    while True:
        page = api("GET", "/workflows?limit=100" + (f"&cursor={cursor}" if cursor else ""))
        for w in page.get("data", []):
            out[w["name"]] = w
        cursor = page.get("nextCursor")
        if not cursor:
            return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", action="append", default=[])
    args = ap.parse_args()

    files = sorted(HERE.glob("vapi-*.json"))
    if args.only:
        files = [f for f in files if f.name in args.only]
    if not files:
        sys.exit("no workflow files selected")

    live = existing_by_name()
    for f in files:
        wf = json.loads(f.read_text(encoding="utf-8"))
        body = {k: wf[k] for k in ("name", "nodes", "connections", "settings")}
        # Twilio identifiers are placeholders in the tracked JSONs (GitHub push protection
        # flags an Account SID in a public repo) and are injected here from the environment.
        raw = json.dumps(body)
        for placeholder, env_name in (("REPLACE_ME_TWILIO_ACCOUNT_SID", "TWILIO_ACCOUNT_SID"),
                                      ("REPLACE_ME_TWILIO_MESSAGING_SERVICE_SID", "TWILIO_MESSAGING_SERVICE_SID")):
            if placeholder in raw:
                value = os.environ.get(env_name)
                if not value:
                    sys.exit(f"{f.name} needs {env_name} in the environment (see .env.local)")
                raw = raw.replace(placeholder, value)
        body = json.loads(raw)
        if "REPLACE_ME" in raw:
            sys.exit(f"{f.name}: still carries a REPLACE_ME placeholder — fix the credential ids first")
        prior = live.get(body["name"])
        if args.dry_run:
            print(f"{'UPDATE' if prior else 'CREATE'}  {f.name}  ->  {body['name']}" + (f"  (id {prior['id']})" if prior else ""))
            continue
        if prior:
            res = api("PUT", f"/workflows/{prior['id']}", body)
            wid = res["id"]
            action = "updated"
        else:
            res = api("POST", "/workflows", body)
            wid = res["id"]
            action = "created"
        api("POST", f"/workflows/{wid}/activate")
        webhook = next((n["parameters"]["path"] for n in body["nodes"] if n["type"] == "n8n-nodes-base.webhook"), "?")
        print(f"{action:8} {body['name']:36} id={wid}  active  {BASE}/webhook/{webhook}")


if __name__ == "__main__":
    main()
