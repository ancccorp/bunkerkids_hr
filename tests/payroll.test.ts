import { test } from "node:test";
import assert from "node:assert/strict";
import { basicTax, calcPay, earnedIncomeDeduction } from "../src/lib/payroll";

const rates = { pension: 4.75, health: 3.595, ltc: 13.14, employment: 0.9, pensionMin: 400_000, pensionMax: 6_370_000 };
const base = { mealAllowance: 200_000, dependents: 1, proration: 1, overtimeMinutes: 0, extraPay: 0, extraDeduction: 0 };

test("근로소득공제와 기본세율 구간", () => {
  assert.equal(earnedIncomeDeduction(33_600_000), 10_290_000);
  assert.equal(earnedIncomeDeduction(1_000_000_000), 20_000_000); // 한도
  assert.equal(basicTax(14_000_000), 840_000);
  assert.equal(basicTax(50_000_000), 6_240_000);
});

test("연봉 3,600만 원 1인 가구 월 급여", () => {
  const d = calcPay({ ...base, annualSalary: 36_000_000 }, rates);
  assert.equal(d.gross, 3_000_000);
  assert.equal(d.meal, 200_000);
  assert.equal(d.taxable, 2_800_000);
  assert.equal(d.pension, 133_000);
  assert.equal(d.health, 100_660);
  assert.equal(d.ltc, 13_220);
  assert.equal(d.employment, 25_200);
  assert.ok(d.incomeTax > 50_000 && d.incomeTax < 80_000, `소득세 ${d.incomeTax}`);
  assert.equal(d.localTax, Math.floor(d.incomeTax / 100) * 10);
  assert.equal(d.net, d.gross - d.deductions);
});

test("국민연금 상한 적용", () => {
  const d = calcPay({ ...base, annualSalary: 120_000_000 }, rates);
  assert.equal(d.pension, Math.floor((6_370_000 * 0.0475) / 10) * 10);
});

test("일할 계산과 연장근로수당", () => {
  const d = calcPay({ ...base, annualSalary: 36_000_000, proration: 0.5, overtimeMinutes: 120 }, rates);
  assert.equal(d.meal, 100_000);
  assert.equal(d.base, 1_400_000);
  assert.equal(d.hourlyWage, Math.round(3_000_000 / 209));
  assert.equal(d.overtime, Math.round(d.hourlyWage * 1.5 * 2));
});

test("부양가족이 많을수록 소득세가 줄어든다", () => {
  const one = calcPay({ ...base, annualSalary: 60_000_000 }, rates).incomeTax;
  const four = calcPay({ ...base, annualSalary: 60_000_000, dependents: 4 }, rates).incomeTax;
  assert.ok(four < one);
});

test("월 중 입사·퇴사월은 국민연금·건강보험 미부과, 고용보험은 부과", () => {
  const d = calcPay({ ...base, annualSalary: 36_000_000, proration: 0.5, pensionHealthApplies: false }, rates);
  assert.equal(d.pension, 0);
  assert.equal(d.health, 0);
  assert.equal(d.ltc, 0);
  assert.ok(d.employment > 0);
});
