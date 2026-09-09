import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeTag, mergeTags, removeTags, hasTag, MAX_TAGS } from "./tags.ts"

test("normalizeTag shapes free text", () => {
  assert.equal(normalizeTag("VIP Client!"), "vip-client")
  assert.equal(normalizeTag("  Do Not Text "), "do-not-text")
  assert.equal(normalizeTag("gate_code"), "gate-code")
  assert.equal(normalizeTag("--weird--"), "weird")
  assert.equal(normalizeTag("a"), null)
  assert.equal(normalizeTag("!!!"), null)
  assert.equal(normalizeTag("x".repeat(25)), null)
  assert.equal(normalizeTag(null), null)
})

test("mergeTags dedupes, keeps order, caps", () => {
  assert.deepEqual(mergeTags(["vip"], ["VIP", "hoa", "hoa"]), ["vip", "hoa"])
  const many = Array.from({ length: 20 }, (_, i) => `tag-${i}`)
  assert.equal(mergeTags([], many).length, MAX_TAGS)
})

test("removeTags and hasTag are normalization-aware", () => {
  assert.deepEqual(removeTags(["vip", "hoa"], ["HOA"]), ["vip"])
  assert.equal(hasTag(["do-not-text"], "Do Not Text"), true)
  assert.equal(hasTag(null, "vip"), false)
})
