// The unit-test entry point. Run: npm test
//   = node --experimental-strip-types scripts/test.mjs
//
// node:test registers every test the imported files declare and runs them
// in-process, setting a non-zero exit code on failure. Files are listed
// explicitly rather than globbed: shell globbing is not portable to Windows
// and .ts discovery under type stripping is version-sensitive. Add new test
// files here.
//
// Rule for anything imported below: pure modules only. No Supabase, no Next,
// no "@/..." path aliases (Node cannot resolve them), relative imports with
// the .ts extension. That constraint is what keeps the business math testable.

import "../lib/squeegee/services.test.ts"
import "../lib/squeegee/dates.test.ts"
import "../lib/squeegee/cadence.test.ts"
import "../lib/squeegee/tags.test.ts"
import "../lib/squeegee/lead-source.test.ts"
import "../lib/squeegee/followup-schedule.test.ts"
import "../lib/squeegee/metrics.test.ts"
import "../lib/squeegee/offers.test.ts"
