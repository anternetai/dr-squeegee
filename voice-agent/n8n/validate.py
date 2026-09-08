#!/usr/bin/env python3
"""
Validates the Vapi n8n workflow JSON files (vapi-*.json) in this directory
against the house conventions verified in CONTEXT.md (build context,
verified 2026-08-28).

Checks per file:
  - valid JSON
  - required top-level keys present (name, nodes, connections, settings);
    forbidden top-level keys (id, active, versionId) absent
  - settings == {"executionOrder": "v1"}
  - every node has id / name / type / typeVersion / position / parameters
  - every `connections` key matches an existing node **name**
  - every connection target ("node" field) matches an existing node name
  - every node is reachable from the webhook trigger (sticky notes exempt -
    they are canvas annotations, not part of the execution graph)
  - every non-sticky node participates in `connections` (no orphans)
  - exactly one webhook node and at least one respondToWebhook node
  - typeVersions match the CURRENT n8n typeVersions table from CONTEXT.md

Usage:
    python3 validate.py
Exit code 0 if every file passes, 1 otherwise.
"""
import json
import os
import sys
import glob

DIR = os.path.dirname(os.path.abspath(__file__))

REQUIRED_TOP_KEYS = ["name", "nodes", "connections", "settings"]
FORBIDDEN_TOP_KEYS = ["id", "active", "versionId"]
REQUIRED_NODE_KEYS = ["id", "name", "type", "typeVersion", "position", "parameters"]

# CURRENT n8n typeVersions, verified live 2026-08-28 (CONTEXT.md):
# webhook 2.1 | respondToWebhook 1.4 | code 2 | httpRequest 4.3 | switch 3.3 |
# if 2.2 | set 3.4 | googleSheets 4.7 | gmail 2.1 | twilio 1 | postgres 2.6
EXPECTED_TYPEVERSIONS = {
    "n8n-nodes-base.webhook": 2.1,
    "n8n-nodes-base.respondToWebhook": 1.4,
    "n8n-nodes-base.code": 2,
    "n8n-nodes-base.httpRequest": 4.3,
    "n8n-nodes-base.switch": 3.3,
    "n8n-nodes-base.if": 2.2,
    "n8n-nodes-base.set": 3.4,
    "n8n-nodes-base.googleSheets": 4.7,
    "n8n-nodes-base.gmail": 2.1,
    "n8n-nodes-base.twilio": 1,
    "n8n-nodes-base.postgres": 2.6,
}

# Pure canvas annotations - not part of the execution graph, so exempt from
# reachability / "must be wired into connections" checks.
NON_EXECUTABLE_TYPES = {"n8n-nodes-base.stickyNote"}


def validate_file(path):
    errors = []
    warnings = []

    raw = open(path, "r", encoding="utf-8").read()
    try:
        wf = json.loads(raw)
    except json.JSONDecodeError as e:
        return [f"INVALID JSON: {e}"], warnings

    if not isinstance(wf, dict):
        return ["workflow root must be a JSON object"], warnings

    for forbidden in FORBIDDEN_TOP_KEYS:
        if forbidden in wf:
            errors.append(f"top-level key '{forbidden}' must not be present")

    for key in REQUIRED_TOP_KEYS:
        if key not in wf:
            errors.append(f"missing required top-level key '{key}'")

    if wf.get("settings") != {"executionOrder": "v1"}:
        errors.append(
            f"settings must be exactly {{'executionOrder': 'v1'}}, got {wf.get('settings')!r}"
        )

    nodes = wf.get("nodes")
    if not isinstance(nodes, list) or len(nodes) == 0:
        errors.append("nodes must be a non-empty list")
        return errors, warnings

    name_to_node = {}
    for i, n in enumerate(nodes):
        if not isinstance(n, dict):
            errors.append(f"node[{i}] is not an object")
            continue

        for key in REQUIRED_NODE_KEYS:
            if key not in n:
                errors.append(f"node[{i}] ({n.get('name', '?')}) missing required key '{key}'")

        name = n.get("name")
        if name is None:
            continue
        if name in name_to_node:
            errors.append(f"duplicate node name '{name}'")
        name_to_node[name] = n

        ntype = n.get("type")
        tv = n.get("typeVersion")
        if ntype in EXPECTED_TYPEVERSIONS:
            expected = EXPECTED_TYPEVERSIONS[ntype]
            if tv != expected:
                errors.append(
                    f"node '{name}' ({ntype}) typeVersion {tv!r} != expected {expected!r}"
                )

        pos = n.get("position")
        if not (
            isinstance(pos, list)
            and len(pos) == 2
            and all(isinstance(v, (int, float)) for v in pos)
        ):
            errors.append(f"node '{name}' position must be a 2-element numeric array, got {pos!r}")

        if "parameters" in n and not isinstance(n["parameters"], dict):
            errors.append(f"node '{name}' parameters must be an object")

    webhook_nodes = [n for n in nodes if n.get("type") == "n8n-nodes-base.webhook"]
    respond_nodes = [n for n in nodes if n.get("type") == "n8n-nodes-base.respondToWebhook"]
    if len(webhook_nodes) != 1:
        errors.append(f"expected exactly 1 webhook node, found {len(webhook_nodes)}")
    if len(respond_nodes) < 1:
        errors.append(f"expected at least 1 respondToWebhook node, found {len(respond_nodes)}")

    connections = wf.get("connections")
    if not isinstance(connections, dict):
        errors.append("connections must be an object")
        connections = {}

    for src_name, outputs in connections.items():
        if src_name not in name_to_node:
            errors.append(f"connections key '{src_name}' does not match any node name")
            continue
        if not isinstance(outputs, dict) or "main" not in outputs:
            errors.append(f"connections['{src_name}'] must be an object with a 'main' key")
            continue
        mains = outputs["main"]
        if not isinstance(mains, list):
            errors.append(f"connections['{src_name}'].main must be a list")
            continue
        for out_idx, targets in enumerate(mains):
            if targets is None:
                continue
            if not isinstance(targets, list):
                errors.append(f"connections['{src_name}'].main[{out_idx}] must be a list")
                continue
            for t in targets:
                tgt_name = t.get("node") if isinstance(t, dict) else None
                if tgt_name not in name_to_node:
                    errors.append(
                        f"connections['{src_name}'].main[{out_idx}] references unknown node '{tgt_name}'"
                    )

    # Reachability from the webhook trigger.
    executable_names = {
        n["name"] for n in nodes if n.get("type") not in NON_EXECUTABLE_TYPES and "name" in n
    }
    if len(webhook_nodes) == 1:
        start = webhook_nodes[0]["name"]
        reached = set()
        frontier = [start]
        while frontier:
            cur = frontier.pop()
            if cur in reached:
                continue
            reached.add(cur)
            for targets in connections.get(cur, {}).get("main", []) or []:
                for t in targets or []:
                    tgt_name = t.get("node") if isinstance(t, dict) else None
                    if tgt_name and tgt_name not in reached:
                        frontier.append(tgt_name)
        unreached = executable_names - reached
        if unreached:
            errors.append(f"nodes not reachable from webhook trigger: {sorted(unreached)}")

    # Every non-sticky node (other than the webhook itself) must appear
    # somewhere in connections - as a source or a target - so nothing is
    # silently dangling on the canvas.
    all_targets = set()
    for outputs in connections.values():
        for targets in outputs.get("main") or []:
            for t in targets or []:
                if isinstance(t, dict) and t.get("node"):
                    all_targets.add(t["node"])
    all_sources = set(connections.keys())
    wired = all_sources | all_targets
    for n in nodes:
        if n.get("type") in NON_EXECUTABLE_TYPES:
            continue
        nm = n.get("name")
        if nm in wired:
            continue
        if n.get("type") == "n8n-nodes-base.webhook":
            continue
        errors.append(f"node '{nm}' is not connected to anything (isolated)")

    return errors, warnings


def main():
    pattern = os.path.join(DIR, "vapi-*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"No workflow files found matching {pattern}")
        return 1

    overall_ok = True
    for path in files:
        errors, warnings = validate_file(path)
        rel = os.path.basename(path)
        if errors:
            overall_ok = False
            print(f"FAIL  {rel}")
            for e in errors:
                print(f"      - {e}")
        else:
            print(f"PASS  {rel}")
        for w in warnings:
            print(f"      ! {w}")

    print()
    if overall_ok:
        print(f"All {len(files)} workflow files passed validation.")
        return 0
    else:
        print("Validation FAILED for one or more files.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
