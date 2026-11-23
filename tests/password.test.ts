import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, passwordProblem, verifyPassword } from "../src/lib/password";

test("해시는 원문을 담지 않고, 같은 비밀번호도 매번 다른 값", async () => {
  const a = await hashPassword("bunker2026!");
  const b = await hashPassword("bunker2026!");
  assert.notEqual(a, b);
  assert.ok(!a.includes("bunker2026"));
  assert.match(a, /^scrypt\$16384\$8\$1\$/);
});

test("맞는 비밀번호만 통과", async () => {
  const h = await hashPassword("bunker2026!");
  assert.equal(await verifyPassword("bunker2026!", h), true);
  assert.equal(await verifyPassword("bunker2026?", h), false);
  assert.equal(await verifyPassword("", h), false);
  assert.equal(await verifyPassword("bunker2026!", null), false);
  assert.equal(await verifyPassword("bunker2026!", "garbage"), false);
});

test("비밀번호 기준", () => {
  assert.ok(passwordProblem("short1"));
  assert.ok(passwordProblem("onlyletters"));
  assert.ok(passwordProblem("12345678"));
  assert.equal(passwordProblem("bunker2026"), null);
});
