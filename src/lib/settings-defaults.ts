/**
 * 회사 설정 기본값. 관리자 > 설정에서 바꿀 수 있다.
 * 4대보험 요율은 2026년 기준이며 매년 1월(국민연금 기준소득월액은 7월) 고시에 맞춰 갱신해야 한다.
 */
export const DEFAULT_SETTINGS = {
  company_name: "주식회사 벙커키즈",
  company_ceo: "대표이사",
  company_reg_no: "000-00-00000",
  company_address: "서울특별시",
  work_start: "10:00",
  work_end: "19:00",
  leave_basis: "hire", // hire = 입사일 기준 | fiscal = 회계연도(1/1) 기준
  pay_day: "25", // 매월 지급일 (당월분)
  rate_pension: "4.75", // 국민연금 근로자 부담 (%)  ─ 2026: 총 9.5%
  rate_health: "3.595", // 건강보험 근로자 부담 (%) ─ 2026: 총 7.19%
  rate_ltc: "13.14", // 장기요양보험 (건강보험료 대비 %)
  rate_employment: "0.9", // 고용보험 근로자 부담 (%)
  pension_min: "400000", // 국민연금 기준소득월액 하한
  pension_max: "6370000", // 국민연금 기준소득월액 상한 (2025.7~2026.6)
};
