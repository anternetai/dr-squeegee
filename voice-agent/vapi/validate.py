#!/usr/bin/env python3
"""Validates the Dr Squeegee Vapi build in this directory.

Checks, in order:
  - every .json file parses
  - assistant.json has model / voice / transcriber / firstMessage
  - the embedded system prompt matches system-prompt.md byte-for-byte
  - every tool has type / function.name / parameters / server.url
  - tool names match the five expected, no more, no fewer
  - every JSON-schema `required` list only names real sibling properties
    (checked recursively, everywhere a `required`+`properties` pair appears)
  - the pricing-sensitive enums (houseWashTier, sqftService, coverage) match
    the real values in CONTEXT.md exactly
  - every server URL is https and points at the n8n host
  - no real-looking secret values appear anywhere -- only clearly-marked
    placeholders
  - a handful of structural sanity checks on the live Twilio route
    (app/api/twilio/voice/route.ts), deploy.py and the notes file

Exits 0 and prints "ALL CHECKS PASSED" iff everything holds; otherwise prints
every failure found and exits 1.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

VAPI_DIR = Path(__file__).resolve().parent
FAILURES: list[str] = []


def fail(msg: str) -> None:
    FAILURES.append(msg)


def check(cond: bool, msg: str) -> bool:
    if not cond:
        fail(msg)
    return cond


# ---------------------------------------------------------------------------
# 1. Every JSON file parses
# ---------------------------------------------------------------------------
json_files = sorted(VAPI_DIR.glob("*.json"))
if not check(len(json_files) >= 2, "expected at least assistant.json and tools.json in this directory"):
    pass

parsed: dict[str, object] = {}
for jf in json_files:
    try:
        parsed[jf.name] = json.loads(jf.read_text())
    except json.JSONDecodeError as e:
        fail(f"{jf.name} is not valid JSON: {e}")

assistant = parsed.get("assistant.json")
tools = parsed.get("tools.json")

if assistant is None:
    fail("assistant.json missing or failed to parse -- skipping assistant-specific checks")
if tools is None:
    fail("tools.json missing or failed to parse -- skipping tool-specific checks")

# ---------------------------------------------------------------------------
# 2. assistant.json has model / voice / transcriber / firstMessage
# ---------------------------------------------------------------------------
if assistant is not None:
    for key in ("model", "voice", "transcriber", "firstMessage"):
        check(key in assistant and assistant[key], f"assistant.json is missing required field '{key}'")

    check(assistant.get("model", {}).get("provider") == "openai", "model.provider should be 'openai'")
    check(assistant.get("model", {}).get("model") == "gpt-4o-mini", "model.model should be 'gpt-4o-mini'")
    check(assistant.get("model", {}).get("temperature") == 0.3, "model.temperature should be 0.3")
    check(assistant.get("model", {}).get("maxTokens") == 250, "model.maxTokens should be 250")

    # voice: fast/warm/natural primary + a DIFFERENT-provider fallback (outage insurance)
    voice = assistant.get("voice", {})
    fb_voices = voice.get("fallbackPlan", {}).get("voices", [])
    check(len(fb_voices) >= 1, "voice.fallbackPlan.voices should have at least one fallback voice")
    if fb_voices:
        check(
            fb_voices[0].get("provider") != voice.get("provider"),
            "voice fallbackPlan's first voice should be a DIFFERENT provider than the primary voice (outage insurance)",
        )

    check(assistant.get("transcriber", {}).get("provider") == "deepgram", "transcriber.provider should be 'deepgram'")

    # turn-taking knobs called out in the brief
    stp = assistant.get("startSpeakingPlan", {})
    check("transcriptionEndpointingPlan" in stp, "startSpeakingPlan.transcriptionEndpointingPlan should be set")
    check(
        isinstance(stp.get("transcriptionEndpointingPlan", {}).get("onNumberSeconds"), (int, float)),
        "startSpeakingPlan.transcriptionEndpointingPlan.onNumberSeconds should be set (digit-string addresses/phone numbers)",
    )
    check("numWords" in assistant.get("stopSpeakingPlan", {}), "stopSpeakingPlan.numWords should be set")
    check(
        assistant.get("backgroundSpeechDenoisingPlan", {}).get("smartDenoisingPlan", {}).get("enabled") is True,
        "backgroundSpeechDenoisingPlan.smartDenoisingPlan.enabled should be true",
    )

    # deliberate, non-default call-length guards
    check(isinstance(assistant.get("silenceTimeoutSeconds"), (int, float)), "silenceTimeoutSeconds should be set")
    max_dur = assistant.get("maxDurationSeconds")
    check(isinstance(max_dur, (int, float)), "maxDurationSeconds should be set")
    check(
        isinstance(max_dur, (int, float)) and max_dur > 600,
        "maxDurationSeconds should be deliberately raised above the 600s platform default for a qualify->quote->book call",
    )

    check(bool(assistant.get("voicemailDetection")), "voicemailDetection should be set")
    check(bool(assistant.get("voicemailMessage")), "voicemailMessage should be set")

    ap = assistant.get("analysisPlan", {})
    check("summaryPlan" in ap, "analysisPlan.summaryPlan should be set")
    sdp_schema = ap.get("structuredDataPlan", {}).get("schema", {})
    check(bool(sdp_schema), "analysisPlan.structuredDataPlan.schema should be set")
    expected_sdp_fields = {
        "callerName", "phoneNumber", "serviceAddress", "servicesRequested",
        "quotedPriceUsd", "appointmentBooked", "appointmentTime",
        "smsConsentGiven", "outcome", "callbackRequested",
    }
    sdp_props = set(sdp_schema.get("properties", {}).keys())
    check(
        expected_sdp_fields.issubset(sdp_props),
        f"structuredDataPlan.schema is missing fields: {sorted(expected_sdp_fields - sdp_props)}",
    )
    outcome_enum = set(sdp_schema.get("properties", {}).get("outcome", {}).get("enum", []))
    expected_outcomes = {"booked", "lead_captured", "existing_customer_handled", "wrong_number", "no_action"}
    check(outcome_enum == expected_outcomes, f"outcome enum should be exactly {sorted(expected_outcomes)}, got {sorted(outcome_enum)}")

    artifact_plan = assistant.get("artifactPlan", {})
    check(artifact_plan.get("recordingEnabled") is True, "artifactPlan.recordingEnabled should be true")
    check(
        artifact_plan.get("transcriptPlan", {}).get("enabled") is True,
        "artifactPlan.transcriptPlan.enabled should be true",
    )

    check(
        assistant.get("server", {}).get("url", "").endswith("/webhook/vapi/end-of-call"),
        "assistant.json server.url should be the /webhook/vapi/end-of-call endpoint",
    )
    check(
        "x-vapi-secret" in assistant.get("server", {}).get("headers", {}),
        "assistant.json server.headers should carry an x-vapi-secret placeholder",
    )
    expected_server_messages = {"end-of-call-report", "status-update", "hang"}
    check(
        set(assistant.get("serverMessages", [])) == expected_server_messages,
        f"serverMessages should be exactly {sorted(expected_server_messages)}",
    )

    # built-in tools: endCall + transferCall to Anthony's cell, warm-transfer mode
    model_tools = assistant.get("model", {}).get("tools", [])
    tool_types = [t.get("type") for t in model_tools]
    check("endCall" in tool_types, "model.tools should include a built-in endCall tool")
    check("transferCall" in tool_types, "model.tools should include a built-in transferCall tool")
    transfer_tools = [t for t in model_tools if t.get("type") == "transferCall"]
    if transfer_tools:
        dests = transfer_tools[0].get("destinations", [])
        numbers = [d.get("number") for d in dests]
        check("+19802428048" in numbers, "transferCall destination should be Anthony's cell, +19802428048")
        modes = [d.get("transferPlan", {}).get("mode") for d in dests]
        check(
            any(m and str(m).startswith("warm-transfer") for m in modes),
            "transferCall destination should use a warm-transfer-* mode",
        )

    # toolIds: five clearly-marked placeholders (created by tools.json / deploy.sh)
    tool_ids = assistant.get("model", {}).get("toolIds", [])
    check(len(tool_ids) == 5, f"model.toolIds should have 5 entries (placeholders for the 5 custom tools), got {len(tool_ids)}")
    check(
        all(isinstance(t, str) and "REPLACE" in t.upper() for t in tool_ids),
        "model.toolIds entries should be clearly-marked placeholders (containing 'REPLACE')",
    )

    check(
        isinstance(assistant.get("voice", {}).get("voiceId"), str) and "REPLACE" in assistant["voice"]["voiceId"].upper(),
        "voice.voiceId should be a clearly-marked placeholder -- voice choice is personal",
    )

# ---------------------------------------------------------------------------
# 3. system prompt in assistant.json matches system-prompt.md byte-for-byte
# ---------------------------------------------------------------------------
prompt_file = VAPI_DIR / "system-prompt.md"
if not check(prompt_file.exists(), "system-prompt.md is missing"):
    pass
elif assistant is not None:
    md_content = prompt_file.read_text()
    messages = assistant.get("model", {}).get("messages", [])
    system_messages = [m for m in messages if m.get("role") == "system"]
    if not check(len(system_messages) == 1, "model.messages should contain exactly one role:system message"):
        pass
    else:
        embedded = system_messages[0].get("content", "")
        check(
            embedded == md_content,
            "the embedded system prompt (model.messages[0].content) does not match system-prompt.md byte-for-byte",
        )

# ---------------------------------------------------------------------------
# 4. every tool has type / function.name / parameters / server.url; names match
# ---------------------------------------------------------------------------
EXPECTED_TOOL_NAMES = {"lookup_caller", "quote_service", "check_availability", "book_job", "capture_lead"}

if tools is not None:
    check(isinstance(tools, list), "tools.json should be a JSON array")
    names = []
    for i, t in enumerate(tools if isinstance(tools, list) else []):
        label = f"tools.json[{i}]"
        check(t.get("type") == "function", f"{label}: type should be 'function'")
        fn = t.get("function", {})
        name = fn.get("name")
        check(bool(name), f"{label}: function.name is required")
        check(bool(fn.get("description")), f"{label} ({name}): function.description is required")
        check("parameters" in fn, f"{label} ({name}): function.parameters is required")
        check(
            t.get("server", {}).get("url"),
            f"{label} ({name}): server.url is required",
        )
        check(
            isinstance(t.get("server", {}).get("timeoutSeconds"), (int, float)),
            f"{label} ({name}): server.timeoutSeconds should be set deliberately",
        )
        msg_types = {m.get("type") for m in t.get("messages", [])}
        for required_msg in ("request-start", "request-response-delayed", "request-failed"):
            check(required_msg in msg_types, f"{label} ({name}): messages[] is missing a '{required_msg}' entry")
        if name:
            names.append(name)

    check(
        set(names) == EXPECTED_TOOL_NAMES,
        f"tool names should be exactly {sorted(EXPECTED_TOOL_NAMES)}, got {sorted(set(names))}",
    )
    check(len(names) == len(set(names)), "tool names should be unique (no duplicates)")

    # ---- pricing-sensitive enums must match CONTEXT.md's real constants exactly ----
    by_name = {t.get("function", {}).get("name"): t for t in tools if isinstance(t, dict)}
    quote_tool = by_name.get("quote_service")
    if check(quote_tool is not None, "quote_service tool not found -- skipping pricing-enum checks"):
        qparams = quote_tool["function"]["parameters"]
        props = qparams.get("properties", {})

        expected_house_wash_tiers = {
            "1-story-standard", "1-story-large", "2-story-standard", "2-story-large", "3-story",
        }
        got = set(props.get("houseWashTier", {}).get("enum", []))
        check(
            got == expected_house_wash_tiers,
            f"quote_service.houseWashTier enum should be exactly {sorted(expected_house_wash_tiers)}, got {sorted(got)}",
        )

        expected_sqft_services = {"Driveway", "Surface Cleaning", "Pool Deck", "Pavers"}
        got = set(props.get("sqftService", {}).get("enum", []))
        check(
            got == expected_sqft_services,
            f"quote_service.sqftService enum should be exactly {sorted(expected_sqft_services)}, got {sorted(got)}",
        )

        expected_coverage = {"exterior", "both"}
        got = set(props.get("coverage", {}).get("enum", []))
        check(
            got == expected_coverage,
            f"quote_service.coverage enum should be exactly {sorted(expected_coverage)}, got {sorted(got)}",
        )

        for story_key in ("story1", "story2", "story3"):
            check(
                story_key in props.get("windowCounts", {}).get("properties", {}),
                f"quote_service.windowCounts should have a '{story_key}' property (per-story window counts)",
            )

    # book_job.phoneNumber / capture_lead.phoneNumber should require +1##########
    for tname in ("book_job", "capture_lead"):
        t = by_name.get(tname)
        if check(t is not None, f"{tname} tool not found"):
            phone_schema = t["function"]["parameters"]["properties"].get("phoneNumber", {})
            check(
                phone_schema.get("pattern") == r"^\+1[0-9]{10}$",
                f"{tname}.phoneNumber should have the E.164-US pattern ^\\+1[0-9]{{10}}$",
            )


# ---------------------------------------------------------------------------
# 5. required/properties consistency, checked recursively across ALL JSON files
#    (a `required` entry that names a property that doesn't exist is a real
#    bug in a tool schema -- this catches it wherever it might be nested)
# ---------------------------------------------------------------------------
def check_schema_consistency(node: object, path: str) -> None:
    if isinstance(node, dict):
        if "required" in node and isinstance(node.get("required"), list) and "properties" in node:
            props = node.get("properties", {})
            for req in node["required"]:
                check(
                    req in props,
                    f"{path}: 'required' names '{req}' which is not in this schema's 'properties'",
                )
        if "dependentRequired" in node and isinstance(node.get("dependentRequired"), dict) and "properties" in node:
            props = node.get("properties", {})
            for trigger_key, required_list in node["dependentRequired"].items():
                check(
                    trigger_key in props,
                    f"{path}: dependentRequired key '{trigger_key}' is not in this schema's 'properties'",
                )
                for req in required_list:
                    check(
                        req in props,
                        f"{path}: dependentRequired['{trigger_key}'] names '{req}' which is not in 'properties'",
                    )
        for k, v in node.items():
            check_schema_consistency(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            check_schema_consistency(v, f"{path}[{i}]")


for fname, data in parsed.items():
    check_schema_consistency(data, fname)

# ---------------------------------------------------------------------------
# 6. every server URL is https and points at the n8n host
# ---------------------------------------------------------------------------
N8N_HOST = "n8n-production-1286.up.railway.app"


def find_server_urls(node: object, path: str, out: list[tuple[str, str]]) -> None:
    if isinstance(node, dict):
        if "server" in node and isinstance(node["server"], dict) and "url" in node["server"]:
            out.append((f"{path}.server.url", node["server"]["url"]))
        for k, v in node.items():
            find_server_urls(v, f"{path}.{k}", out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            find_server_urls(v, f"{path}[{i}]", out)


all_server_urls: list[tuple[str, str]] = []
for fname, data in parsed.items():
    find_server_urls(data, fname, all_server_urls)

check(len(all_server_urls) >= 6, f"expected at least 6 server.url occurrences (1 assistant + 5 tools), found {len(all_server_urls)}")
for path, url in all_server_urls:
    parsed_url = urlparse(url)
    check(parsed_url.scheme == "https", f"{path} ('{url}') should use https")
    check(parsed_url.netloc == N8N_HOST, f"{path} ('{url}') should point at {N8N_HOST}, got '{parsed_url.netloc}'")

expected_paths = {
    "/webhook/vapi/lookup-caller",
    "/webhook/vapi/quote-service",
    "/webhook/vapi/check-availability",
    "/webhook/vapi/book-job",
    "/webhook/vapi/capture-lead",
    "/webhook/vapi/end-of-call",
}
got_paths = {urlparse(u).path for _, u in all_server_urls}
check(
    expected_paths.issubset(got_paths),
    f"missing expected webhook paths: {sorted(expected_paths - got_paths)}",
)

# ---------------------------------------------------------------------------
# 7. no real secret values anywhere -- only clearly-marked placeholders
# ---------------------------------------------------------------------------
PLACEHOLDER_MARKERS = ("REPLACE_ME", "REPLACE_WITH", "PLACEHOLDER", "<credentialId>", "<CREDENTIAL")

# Known-safe long tokens that legitimately appear and are not secrets.
SAFE_SUBSTRINGS = (
    "n8n-production-1286.up.railway.app",
    "webhook/vapi/",
    "eleven_flash_v2_5",
    "smartDenoisingPlan",
    "transcriptionEndpointingPlan",
    "warm-transfer-say-summary",
    "backgroundSpeechDenoisingPlan",
    "existing_customer_handled",
    "needs_onsite_quote",
    "not_ready_to_book",
    "reschedule_request",
    "quote_follow_up",
    "callbackRequested",
    "smsConsentGiven",
    "appointmentBooked",
    "servicesRequested",
    "serviceAddress",
    "quotedPriceUsd",
    "check_availability",
    "capture_lead",
    "lookup_caller",
    "quote_service",
    "book_job",
    "1-story-standard",
    "1-story-large",
    "2-story-standard",
    "2-story-large",
    "sonic-3",
    "dependentRequired",
    "additionalProperties",
    "exclusiveMinimum",
    "sip.vapi.ai",
    "credentialId",
    "DEFAULT_VAPI_NUMBER",
    "ed04ba43-9e10-451d-bec5-667251a35bde",
)

# Prefix patterns of well-known real secret formats -- if any of these show
# up literally, something went badly wrong regardless of length.
SECRET_PREFIX_RE = re.compile(
    r"(sk-[A-Za-z0-9]{10,}|sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+|"
    r"AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9._-]{20,}|AC[a-f0-9]{32}|SK[a-f0-9]{32})"
)
# Generic "looks like a random API key" token: a long unbroken run of
# base62/underscore/dash/dot characters with no spaces.
GENERIC_TOKEN_RE = re.compile(r"[A-Za-z0-9_\-\.]{28,}")


def looks_like_url_or_path(token: str) -> bool:
    return token.startswith("http://") or token.startswith("https://") or token.startswith("/webhook/")


def scan_text_for_secrets(text: str, label: str) -> None:
    for m in SECRET_PREFIX_RE.finditer(text):
        fail(f"{label}: text matches a known real-secret pattern near '{m.group(0)[:12]}...'")
    for m in GENERIC_TOKEN_RE.finditer(text):
        token = m.group(0)
        if any(marker in token.upper() for marker in ("REPLACE", "PLACEHOLDER")):
            continue
        if looks_like_url_or_path(token):
            continue
        if any(safe in token for safe in SAFE_SUBSTRINGS):
            continue
        # allow long snake_case/kebab-case English phrases pulled from prose
        # (tool descriptions etc.) -- those aren't secrets, they just lack
        # spaces around punctuation sometimes. Flag only if it also looks
        # high-entropy: has a digit AND a letter AND either mixed case or a
        # dash/underscore run typical of generated tokens, AND is not simply
        # an E.164-ish phone number.
        if re.fullmatch(r"\+?[0-9\-]{8,20}", token):
            continue  # phone numbers
        has_digit = any(c.isdigit() for c in token)
        has_alpha = any(c.isalpha() for c in token)
        if has_digit and has_alpha:
            fail(f"{label}: possible secret-like token found: '{token[:16]}...' (len={len(token)})")


ROUTE_FILE = VAPI_DIR.parents[1] / "app" / "api" / "twilio" / "voice" / "route.ts"
TEXT_FILES_TO_SCAN = ["assistant.json", "tools.json", "system-prompt.md", "twilio-voice-route.NOTES.md", "deploy.py"]
for fpath in [VAPI_DIR / f for f in TEXT_FILES_TO_SCAN] + [ROUTE_FILE]:
    if fpath.exists():
        scan_text_for_secrets(fpath.read_text(encoding="utf-8"), fpath.name)
    else:
        fail(f"expected file missing: {fpath}")

# Confirm the KNOWN placeholder fields are actually, positively marked as such.
if assistant is not None:
    check(
        any(marker in assistant.get("server", {}).get("headers", {}).get("x-vapi-secret", "") for marker in PLACEHOLDER_MARKERS),
        "assistant.json server.headers.x-vapi-secret should be a clearly-marked placeholder",
    )
if tools is not None:
    for t in tools:
        secret_val = t.get("server", {}).get("headers", {}).get("x-vapi-secret", "")
        check(
            any(marker in secret_val for marker in PLACEHOLDER_MARKERS),
            f"{t.get('function', {}).get('name')}: server.headers.x-vapi-secret should be a clearly-marked placeholder",
        )

# ---------------------------------------------------------------------------
# 8. structural sanity checks: deploy.py, the live Twilio route, notes file
# ---------------------------------------------------------------------------
deploy_py = VAPI_DIR / "deploy.py"
if check(deploy_py.exists(), "deploy.py is missing"):
    txt = deploy_py.read_text(encoding="utf-8")
    check('os.environ.get("VAPI_PRIVATE_KEY")' in txt, "deploy.py should only ever read VAPI_PRIVATE_KEY from the environment")
    check("VAPI_SERVER_SECRET" in txt, "deploy.py should inject VAPI_SERVER_SECRET into working copies")
    check("toolIds" in txt, "deploy.py should inject ids into model.toolIds")
    check("User-Agent" in txt, "deploy.py must send a User-Agent (Cloudflare 1010 blocks Python's default)")

if check(ROUTE_FILE.exists(), "app/api/twilio/voice/route.ts is missing"):
    txt = ROUTE_FILE.read_text(encoding="utf-8")
    check(txt.count("{") == txt.count("}"), "route.ts has unbalanced braces")
    check(txt.count("(") == txt.count(")"), "route.ts has unbalanced parens")
    check(txt.count("`") % 2 == 0, "route.ts has an unbalanced template-literal backtick")
    for needle, desc in [
        ("TWILIO_VOICE_TOKEN", "existing token auth"),
        ("+19802428048", "Anthony's cell number"),
        ('timeout="${RING_SECONDS}"', "the tunable ring to Anthony's cell"),
        ("VAPI_PHONE_NUMBER", "the Vapi hand-off env override / kill switch"),
        ("DEFAULT_VAPI_NUMBER", "the Vapi number constant"),
        ("leg=vapi", "the hand-off leg's own action callback"),
        ("<Hangup/>", "the completed|answered hangup branch"),
        ("escapeXml", "XML-escaping of user-controlled From"),
        ("sip.vapi.ai", "the alternative BYO-SIP approach, noted in a comment"),
        ('form?.get("From")', "reading the original caller's number off the inbound form data"),
    ]:
        check(needle in txt, f"route.ts should contain '{needle}' ({desc})")
    check('"completed"' in txt and '"answered"' in txt, "should preserve the completed|answered status check")

notes_file = VAPI_DIR / "twilio-voice-route.NOTES.md"
if check(notes_file.exists(), "twilio-voice-route.NOTES.md is missing"):
    txt = notes_file.read_text()
    for needle in ("VAPI_PHONE_NUMBER", "SIP", "credentialId", "Approach A", "Approach B"):
        check(needle in txt, f"twilio-voice-route.NOTES.md should mention '{needle}'")

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
if FAILURES:
    print(f"{len(FAILURES)} CHECK(S) FAILED:\n")
    for f in FAILURES:
        print(f" - {f}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED")
    sys.exit(0)
