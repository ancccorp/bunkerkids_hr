import "server-only";
import { all, get, run } from "./db";
import { addDays, daysBetween, workedMinutes } from "./dates";
import { calcPay, type PayDetail, type PayrollRates } from "./payroll";
import { departmentPath, type User } from "./queries";
import { getSettings } from "./settings";

export type CertificateSnapshot = {
  name: string;
  birth_date: string | null;
  department: string;
  title: string | null;
  join_date: string;
  leave_date: string | null;
  status: string;
  company: string;
  ceo: string;
  reg_no: string;
  address: string;
};

/** 증명서는 발급 시점의 정보를 고정 저장한다 (이후 인사정보가 바뀌어도 발급본은 그대로). */
export function certificateSnapshot(user: User): CertificateSnapshot {
  const s = getSettings();
  return {
    name: user.name,
    birth_date: user.birth_date,
    department: departmentPath(user.department_id).join(" › "),
    title: user.title,
    join_date: user.join_date,
    leave_date: user.leave_date,
    status: user.status,
    company: s.company_name,
    ceo: s.company_ceo,
    reg_no: s.company_reg_no,
    address: s.company_address,
  };
}

export function payrollRates(): PayrollRates {
  const s = getSettings();
  return {
    pension: Number(s.rate_pension),
    health: Number(s.rate_health),
    ltc: Number(s.rate_ltc),
    employment: Number(s.rate_employment),
    pensionMin: Number(s.pension_min),
    pensionMax: Number(s.pension_max),
  };
}

/** 해당 월 일 8시간을 넘긴 근무 기록의 합 (연장근로) */
export function overtimeMinutes(userId: number, month: string) {
  const recs = all<{ start_time: string; end_time: string }>(
    "SELECT start_time, end_time FROM work_records WHERE user_id = ? AND substr(date, 1, 7) = ?", userId, month);
  return recs.reduce((a, r) => a + Math.max(0, workedMinutes(r.start_time, r.end_time) - 480), 0);
}

/**
 * 급여 대장 계산. 연봉이 등록된 재직 구성원(휴직 제외)을 대상으로 하며,
 * 이미 입력된 기타 수당·공제·메모는 유지한 채 다시 계산한다.
 */
export function buildPayslip(runId: number, month: string, onlyUserId?: number) {
  const first = `${month}-01`;
  const next = addDays(`${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, "0")}`, 1);
  const monthDays = daysBetween(first, next);
  const rates = payrollRates();
  const users = all<User>(
    `SELECT * FROM users WHERE annual_salary > 0 AND status != '휴직' AND join_date < ?
       AND (leave_date IS NULL OR leave_date >= ?) ${onlyUserId ? "AND id = ?" : ""}`,
    ...(onlyUserId ? [next, first, onlyUserId] : [next, first]));

  for (const u of users) {
    const from = u.join_date > first ? u.join_date : first;
    const to = u.leave_date && u.leave_date < next ? addDays(u.leave_date, 1) : next;
    const proration = Math.max(0, daysBetween(from, to)) / monthDays;
    const prev = get<{ extra_pay: number; extra_deduction: number; memo: string | null }>(
      "SELECT extra_pay, extra_deduction, memo FROM payslips WHERE run_id = ? AND user_id = ?", runId, u.id);
    const d: PayDetail = calcPay(
      {
        annualSalary: u.annual_salary!,
        mealAllowance: u.meal_allowance,
        dependents: u.dependents,
        proration,
        overtimeMinutes: overtimeMinutes(u.id, month),
        extraPay: prev?.extra_pay ?? 0,
        extraDeduction: prev?.extra_deduction ?? 0,
        // 월 중 입사(1일 제외) 또는 상실일(퇴사 다음 날)이 이달에 속하면 국민연금·건강보험 미부과
        pensionHealthApplies: !(u.join_date > first) && !(u.leave_date && addDays(u.leave_date, 1) < next),
      },
      rates,
    );
    run(
      `INSERT INTO payslips (run_id, user_id, extra_pay, extra_deduction, memo, detail, gross, deductions, net)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (run_id, user_id) DO UPDATE SET detail = excluded.detail, gross = excluded.gross,
         deductions = excluded.deductions, net = excluded.net`,
      runId, u.id, d.extraPay, d.extraDeduction, prev?.memo ?? null, JSON.stringify(d), d.gross, d.deductions, d.net);
  }
}
