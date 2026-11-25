/**
 * 월 급여 계산 (순수 함수).
 *
 * - 연봉은 식대를 포함한 금액. 월 지급액 = 연봉 / 12, 그중 식대(월 20만 원 한도)는 비과세.
 * - 입·퇴사 월은 재직 일수 / 그달 일수로 일할 계산.
 * - 연장근로수당 = 통상시급(월 지급액 / 209시간) × 1.5 × 연장근로시간 (근로기준법 제56조).
 * - 4대보험은 과세 급여(보수월액) 기준, 10원 미만 절사.
 *   국민연금·건강보험(장기요양)은 월 중(1일이 아닌 날) 취득한 달과 자격 상실일이 속한 달에는 부과하지 않는다.
 *   고용보험은 실제 지급한 보수 기준으로 매월 부과한다.
 * - 근로소득세는 국세청 간이세액표를 만드는 산식을 단순화한 **추정치**다.
 *   (근로소득공제 → 인적공제·연금보험료·보험료 공제 → 기본세율 → 근로소득세액공제)
 *   실제 지급 전 간이세액표 또는 세무대리인 계산과 대조해야 한다.
 */

export type PayrollRates = {
  pension: number; // %
  health: number; // %
  ltc: number; // 건강보험료 대비 %
  employment: number; // %
  pensionMin: number;
  pensionMax: number;
};

export type PayInput = {
  annualSalary: number;
  mealAllowance: number;
  dependents: number;
  proration: number; // 0~1, 재직 일수 비율
  overtimeMinutes: number;
  extraPay: number;
  extraDeduction: number;
  /** false 면 국민연금·건강보험·장기요양 미부과 (월 중 입사월, 상실월) */
  pensionHealthApplies?: boolean;
};

export type PayDetail = {
  base: number;
  meal: number;
  overtime: number;
  extraPay: number;
  gross: number;
  taxable: number;
  hourlyWage: number;
  overtimeHours: number;
  proration: number;
  pension: number;
  health: number;
  ltc: number;
  employment: number;
  incomeTax: number;
  localTax: number;
  extraDeduction: number;
  deductions: number;
  net: number;
};

const floor10 = (n: number) => Math.floor(n / 10) * 10;
const MEAL_TAX_FREE_LIMIT = 200_000;

/** 근로소득공제 (소득세법 제47조), 한도 2,000만 원 */
export function earnedIncomeDeduction(g: number) {
  let d: number;
  if (g <= 5_000_000) d = g * 0.7;
  else if (g <= 15_000_000) d = 3_500_000 + (g - 5_000_000) * 0.4;
  else if (g <= 45_000_000) d = 7_500_000 + (g - 15_000_000) * 0.15;
  else if (g <= 100_000_000) d = 12_000_000 + (g - 45_000_000) * 0.05;
  else d = 14_750_000 + (g - 100_000_000) * 0.02;
  return Math.min(d, 20_000_000);
}

/** 종합소득세 기본세율 (소득세법 제55조, 2023년 이후) */
export function basicTax(base: number) {
  const brackets: [number, number, number][] = [
    [14_000_000, 0.06, 0],
    [50_000_000, 0.15, 1_260_000],
    [88_000_000, 0.24, 5_760_000],
    [150_000_000, 0.35, 15_440_000],
    [300_000_000, 0.38, 19_940_000],
    [500_000_000, 0.4, 25_940_000],
    [1_000_000_000, 0.42, 35_940_000],
    [Infinity, 0.45, 65_940_000],
  ];
  if (base <= 0) return 0;
  const [, rate, deduction] = brackets.find(([limit]) => base <= limit)!;
  return base * rate - deduction;
}

/** 근로소득세액공제 (소득세법 제59조) */
export function earnedIncomeTaxCredit(tax: number, gross: number) {
  const credit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.3;
  let cap: number;
  if (gross <= 33_000_000) cap = 740_000;
  else if (gross <= 70_000_000) cap = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  else if (gross <= 120_000_000) cap = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  else cap = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);
  return Math.min(credit, cap);
}

export function calcPay(input: PayInput, r: PayrollRates): PayDetail {
  const monthly = input.annualSalary / 12;
  const meal = Math.round(Math.min(input.mealAllowance, monthly) * input.proration);
  const base = Math.round(monthly * input.proration) - meal;
  const hourlyWage = Math.round(monthly / 209);
  const overtimeHours = Math.round((input.overtimeMinutes / 60) * 100) / 100;
  const overtime = Math.round(hourlyWage * 1.5 * overtimeHours);
  const gross = base + meal + overtime + input.extraPay;
  const taxable = gross - Math.min(meal, MEAL_TAX_FREE_LIMIT);

  const pensionBase = Math.min(Math.max(taxable, r.pensionMin), r.pensionMax);
  const ph = input.pensionHealthApplies !== false && taxable > 0;
  const pension = ph ? floor10((pensionBase * r.pension) / 100) : 0;
  const health = ph ? floor10((taxable * r.health) / 100) : 0;
  const ltc = floor10((health * r.ltc) / 100);
  const employment = floor10((taxable * r.employment) / 100);

  // 간이세액 추정: 월 과세급여를 연 환산해 연간 세액을 구한 뒤 12로 나눈다.
  const annualGross = taxable * 12;
  const earned = annualGross - earnedIncomeDeduction(annualGross);
  const taxBase = earned - 1_500_000 * Math.max(1, input.dependents) - pension * 12 - (health + ltc + employment) * 12;
  const computed = basicTax(taxBase);
  const annualTax = Math.max(0, computed - earnedIncomeTaxCredit(computed, annualGross));
  const incomeTax = floor10(annualTax / 12);
  const localTax = floor10(incomeTax * 0.1);

  const deductions = pension + health + ltc + employment + incomeTax + localTax + input.extraDeduction;
  return {
    base,
    meal,
    overtime,
    extraPay: input.extraPay,
    gross,
    taxable,
    hourlyWage,
    overtimeHours,
    proration: input.proration,
    pension,
    health,
    ltc,
    employment,
    incomeTax,
    localTax,
    extraDeduction: input.extraDeduction,
    deductions,
    net: gross - deductions,
  };
}

export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
