import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { won, type PayDetail } from "@/lib/payroll";
import { PrintButton } from "@/components/PrintButton";

/** 임금명세서 (근로기준법 제48조 제2항: 구성항목·계산방법·공제내역 기재) */
export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  const p = await get<{ id: number; user_id: number; detail: string; memo: string | null; month: string; pay_date: string; status: string; name: string; title: string | null; employee_no: string | null; dependents: number }>(
    `SELECT p.*, r.month, r.pay_date, r.status, u.name, u.title, u.employee_no, u.dependents
     FROM payslips p JOIN payroll_runs r ON r.id = p.run_id JOIN users u ON u.id = p.user_id WHERE p.id = ?`, Number(id));
  if (!p || (me.role !== "admin" && (p.user_id !== me.id || p.status !== "confirmed"))) notFound();
  const d = JSON.parse(p.detail) as PayDetail;
  const s = await getSettings();

  const pay: [string, number, string][] = [
    ["기본급", d.base, d.proration < 1 ? `월 기본급 × 재직일 비율 ${Math.round(d.proration * 1000) / 10}%` : "연봉 ÷ 12 − 식대"],
    ["식대 (비과세)", d.meal, "월 20만 원 한도 비과세"],
    ["연장근로수당", d.overtime, `통상시급 ${won(d.hourlyWage)} × 1.5 × ${d.overtimeHours}시간`],
    ["기타 수당", d.extraPay, p.memo ?? ""],
  ];
  const ded: [string, number, string][] = [
    ["국민연금", d.pension, `보수월액 × ${s.rate_pension}% (상·하한 적용)`],
    ["건강보험", d.health, `보수월액 × ${s.rate_health}%`],
    ["장기요양보험", d.ltc, `건강보험료 × ${s.rate_ltc}%`],
    ["고용보험", d.employment, `보수월액 × ${s.rate_employment}%`],
    ["소득세", d.incomeTax, `간이세액 (공제대상 가족 ${p.dependents}명)`],
    ["지방소득세", d.localTax, "소득세 × 10%"],
    ["기타 공제", d.extraDeduction, ""],
  ];
  const table = (title: string, rows: [string, number, string][], total: number) => (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-50">
          <th className="border border-gray-300 px-3 py-2 text-left">{title}</th>
          <th className="border border-gray-300 px-3 py-2 text-right">금액</th>
          <th className="border border-gray-300 px-3 py-2 text-left font-normal text-gray-500">계산 방법</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v, how]) => (
          <tr key={k}>
            <td className="border border-gray-300 px-3 py-2">{k}</td>
            <td className="border border-gray-300 px-3 py-2 text-right">{won(v)}</td>
            <td className="border border-gray-300 px-3 py-2 text-xs text-gray-500">{how}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className="border border-gray-300 px-3 py-2">합계</td>
          <td className="border border-gray-300 px-3 py-2 text-right">{won(total)}</td>
          <td className="border border-gray-300" />
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <article className="print-page card space-y-6 px-8 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{p.month.replace("-", "년 ")}월 임금명세서</h1>
          <p className="mt-1 text-sm text-gray-500">
            {s.company_name} · 지급일 {p.pay_date}
            {p.status !== "confirmed" && " · (미확정)"}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-4 text-sm">
          <div>
            <span className="text-gray-500">성명</span> {p.name}
          </div>
          <div>
            <span className="text-gray-500">사번</span> {p.employee_no ?? "-"}
          </div>
          <div>
            <span className="text-gray-500">직무</span> {p.title ?? "-"}
          </div>
        </div>
        {table("지급 항목", pay, d.gross)}
        {table("공제 항목", ded, d.deductions)}
        <div className="flex items-center justify-between rounded-lg border-2 border-gray-900 px-5 py-4">
          <span className="font-semibold">실지급액</span>
          <span className="text-2xl font-bold">{won(d.net)}</span>
        </div>
        <p className="text-[11px] text-gray-400">
          근로기준법 제48조 제2항에 따른 임금명세서입니다. 소득세는 간이세액 기준이며, 연말정산 시 확정됩니다.
        </p>
      </article>
    </div>
  );
}
