import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { won, type PayDetail } from "@/lib/payroll";
import { PageShell, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { confirmPayroll, deletePayrollRun, recalcPayroll, updatePayslip } from "@/app/actions";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = get<{ id: number; month: string; pay_date: string; status: string; confirmed_at: string | null }>(
    "SELECT * FROM payroll_runs WHERE id = ?", Number(id));
  if (!r) notFound();
  const slips = all<{ id: number; name: string; title: string | null; detail: string; extra_pay: number; extra_deduction: number; memo: string | null }>(
    "SELECT p.*, u.name, u.title FROM payslips p JOIN users u ON u.id = p.user_id WHERE p.run_id = ? ORDER BY u.name COLLATE NOCASE", r.id);
  const rows = slips.map((s) => ({ ...s, d: JSON.parse(s.detail) as PayDetail }));
  const sum = (k: keyof PayDetail) => rows.reduce((a, x) => a + (x.d[k] as number), 0);
  const draft = r.status === "draft";
  const cols: [string, keyof PayDetail][] = [
    ["기본급", "base"],
    ["식대", "meal"],
    ["연장수당", "overtime"],
    ["기타수당", "extraPay"],
    ["지급계", "gross"],
    ["국민연금", "pension"],
    ["건강보험", "health"],
    ["장기요양", "ltc"],
    ["고용보험", "employment"],
    ["소득세", "incomeTax"],
    ["지방소득세", "localTax"],
    ["기타공제", "extraDeduction"],
    ["공제계", "deductions"],
    ["실지급액", "net"],
  ];

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/payroll" className="text-sm text-gray-500 hover:text-gray-800">
            ← 급여
          </Link>
          <h1 className="page-title mt-1 flex items-center gap-2">
            {r.month} 급여 대장 <StatusBadge status={r.status} />
          </h1>
          <p className="text-sm text-gray-500">
            지급일 {r.pay_date} · {rows.length}명{r.confirmed_at && ` · 확정 ${r.confirmed_at}`}
          </p>
        </div>
        {draft && (
          <div className="flex flex-wrap gap-2">
            <form action={deletePayrollRun}>
              <input type="hidden" name="id" value={r.id} />
              <button className="btn-danger">삭제</button>
            </form>
            <form action={recalcPayroll}>
              <input type="hidden" name="id" value={r.id} />
              <button className="btn-secondary">다시 계산</button>
            </form>
            <form action={confirmPayroll}>
              <input type="hidden" name="id" value={r.id} />
              <button className="btn-primary">확정 (명세서 공개)</button>
            </form>
          </div>
        )}
      </div>

      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        소득세는 간이세액 산식에 따른 추정치입니다. 확정 전 국세청 간이세액표 또는 세무대리인 계산과 대조하고, 차이는 기타공제/기타수당으로 보정하세요.
        연봉이 등록되지 않은 구성원과 휴직자는 제외됩니다.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full whitespace-nowrap text-right text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-3 text-left font-medium">이름</th>
              {cols.map(([h]) => (
                <th key={h} className="px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
              <th className="px-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((x) => (
              <tr key={x.id}>
                <td className="sticky left-0 bg-white px-3 py-2.5 text-left">
                  <Link href={`/payroll/slip/${x.id}`} className="font-medium hover:underline">
                    {x.name}
                  </Link>
                  {x.d.proration < 1 && <span className="ml-1 text-[10px] text-amber-600">일할 {Math.round(x.d.proration * 100)}%</span>}
                </td>
                {cols.map(([h, k]) => (
                  <td key={h} className={`px-3 ${k === "net" ? "font-semibold" : ""}`}>
                    {(x.d[k] as number).toLocaleString("ko-KR")}
                  </td>
                ))}
                <td className="px-3">
                  {draft && (
                    <Modal trigger="수정" title={`${x.name} 급여 조정`} triggerClassName="text-xs text-brand-600 hover:underline">
                      <form action={updatePayslip} className="space-y-3 text-left">
                        <input type="hidden" name="id" value={x.id} />
                        <div>
                          <label className="label">기타 과세 수당 (원)</label>
                          <input name="extra_pay" type="number" min={0} defaultValue={x.extra_pay} className="input" />
                        </div>
                        <div>
                          <label className="label">기타 공제 (원)</label>
                          <input name="extra_deduction" type="number" min={0} defaultValue={x.extra_deduction} className="input" />
                        </div>
                        <div>
                          <label className="label">메모 (명세서에 표시)</label>
                          <input name="memo" defaultValue={x.memo ?? ""} className="input" placeholder="예: 인센티브, 경조금" />
                        </div>
                        <button className="btn-primary w-full">저장 후 재계산</button>
                      </form>
                    </Modal>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td className="sticky left-0 bg-gray-50 px-3 py-3 text-left">합계</td>
              {cols.map(([h, k]) => (
                <td key={h} className="px-3">
                  {sum(k).toLocaleString("ko-KR")}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-right text-sm text-gray-600">
        지급 총액 {won(sum("gross"))} · 실지급 총액 <b>{won(sum("net"))}</b>
      </p>
    </PageShell>
  );
}
