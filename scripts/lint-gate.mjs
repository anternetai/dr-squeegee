// Lint gate: no NEW lint errors, and existing debt can only go down.
//
//   node scripts/lint-gate.mjs            gate (what `npm run verify` runs)
//   node scripts/lint-gate.mjs --update   rewrite lint-baseline.json from the
//                                         current state (do this only when you
//                                         have LOWERED the count; a reviewer
//                                         should see the baseline shrink in
//                                         the same diff that fixed the files)
//
// Why a baseline instead of a clean `eslint`: on 2026-09-08 the repo carried
// 31 pre-existing errors across 18 files (React-compiler purity rules, `any`,
// unescaped quotes). Fixing unrelated files inside a feature commit makes the
// diff unreviewable, and a permanently red `npm run lint` is a gate nobody
// respects. So: the debt is recorded per file, a commit fails if it adds an
// error anywhere, and the baseline shrinks as tracks touch those files.
// Warnings are not gated.

import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, relative, sep } from "node:path"

const root = resolve(import.meta.dirname, "..")
const baselinePath = resolve(root, "lint-baseline.json")
const update = process.argv.includes("--update")

const eslintBin = resolve(root, "node_modules", "eslint", "bin", "eslint.js")
const run = spawnSync(process.execPath, [eslintBin, "--format", "json", "."], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})

if (run.error) {
  console.error("lint-gate: could not run eslint:", run.error.message)
  process.exit(2)
}

let results
try {
  results = JSON.parse(run.stdout)
} catch {
  console.error("lint-gate: eslint did not return JSON. stderr:\n" + run.stderr)
  process.exit(2)
}

const current = {}
const messagesByFile = {}
for (const r of results) {
  if (!r.errorCount) continue
  const file = relative(root, r.filePath).split(sep).join("/")
  current[file] = r.errorCount
  messagesByFile[file] = r.messages.filter((m) => m.severity === 2)
}
const totalNow = Object.values(current).reduce((a, b) => a + b, 0)

if (update) {
  const sorted = Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]]))
  writeFileSync(
    baselinePath,
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), total: totalNow, errors: sorted }, null, 2) + "\n"
  )
  console.log(`lint-gate: baseline written — ${totalNow} errors across ${Object.keys(sorted).length} files`)
  process.exit(0)
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : { total: 0, errors: {} }
const allowed = baseline.errors ?? {}
let failed = false

for (const [file, count] of Object.entries(current)) {
  const max = allowed[file] ?? 0
  if (count > max) {
    failed = true
    console.error(`\n✖ ${file}: ${count} error(s), baseline allows ${max}`)
    for (const m of messagesByFile[file].slice(0, 10)) {
      console.error(`    ${m.line}:${m.column}  ${m.message}  (${m.ruleId ?? "parse"})`)
    }
  }
}

const baseTotal = baseline.total ?? Object.values(allowed).reduce((a, b) => a + b, 0)
if (failed) {
  console.error(`\nlint-gate: FAILED — new lint errors. Fix them (do not raise the baseline).`)
  process.exit(1)
}
if (totalNow < baseTotal) {
  console.log(`lint-gate: OK — ${totalNow} errors (baseline ${baseTotal}). You lowered it: run \`node scripts/lint-gate.mjs --update\` and commit lint-baseline.json.`)
} else {
  console.log(`lint-gate: OK — ${totalNow} errors, none new (baseline ${baseTotal}).`)
}
