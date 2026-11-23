import { test } from "node:test";
import assert from "node:assert/strict";
import { annualEntitlement } from "../src/lib/leave-policy";

const days = (m: number) => m / 480;

test("입사일 기준: 1년 미만은 개근 개월 수만큼, 최대 11일", () => {
  assert.equal(days(annualEntitlement("2026-03-01", "2026-03-31", "hire").minutes), 0);
  assert.equal(days(annualEntitlement("2026-03-01", "2026-04-01", "hire").minutes), 1);
  assert.equal(days(annualEntitlement("2026-03-01", "2026-11-23", "hire").minutes), 8);
  assert.equal(days(annualEntitlement("2025-03-01", "2026-02-28", "hire").minutes), 11);
});

test("입사일 기준: 1년 15일, 3년차부터 2년마다 1일 가산, 최대 25일", () => {
  const e = annualEntitlement("2025-03-01", "2026-03-01", "hire");
  assert.equal(days(e.minutes), 15);
  assert.equal(e.periodStart, "2026-03-01");
  assert.equal(e.periodEnd, "2027-03-01");
  assert.equal(days(annualEntitlement("2023-03-01", "2026-03-01", "hire").minutes), 16); // 근속 3년
  assert.equal(days(annualEntitlement("2021-03-01", "2026-03-01", "hire").minutes), 17); // 근속 5년
  assert.equal(days(annualEntitlement("1990-01-01", "2026-03-01", "hire").minutes), 25);
});

test("말일 입사자는 월 말일 기준으로 발생", () => {
  assert.equal(days(annualEntitlement("2026-01-31", "2026-02-28", "hire").minutes), 1);
});

test("회계연도 기준: 입사연도는 월차, 다음 해 1/1 비례 연차 + 남은 월차", () => {
  // 2025-07-01 입사 → 2025년: 8/1~12/1 5일
  assert.equal(days(annualEntitlement("2025-07-01", "2025-12-31", "fiscal").minutes), 5);
  // 2026-01-02: 비례 15 × 184/365 = 7.56 → 8일(0.5 올림), 이월 5일(미사용), 1월 월차 1일
  const e = annualEntitlement("2025-07-01", "2026-01-02", "fiscal", () => 0);
  const labels = e.lines.map((l) => [l.label.split(" (")[0], days(l.minutes)]);
  assert.deepEqual(labels, [
    ["1년 미만 월 단위 연차", 1],
    ["입사연도 월 단위 연차 이월", 5],
    ["입사연도 재직 비례 연차", 8],
  ]);
  // 1주년(7/1) 이후 이월분 소멸, 월차는 6/1까지 총 6일
  const after = annualEntitlement("2025-07-01", "2026-07-02", "fiscal", () => 0);
  assert.equal(days(after.minutes), 6 + 8);
  // 2027년: 15일
  assert.equal(days(annualEntitlement("2025-07-01", "2027-03-01", "fiscal").minutes), 15);
  // 2029년: 입사연도 제외 근속 3년 → 16일
  assert.equal(days(annualEntitlement("2025-07-01", "2029-03-01", "fiscal").minutes), 16);
});

test("회계연도 기준: 1/1 입사자는 다음 해 15일", () => {
  assert.equal(days(annualEntitlement("2025-01-01", "2026-05-01", "fiscal").minutes), 15);
});

test("입사 전에는 연차가 없다", () => {
  assert.equal(annualEntitlement("2026-12-01", "2026-11-23", "hire").minutes, 0);
});
