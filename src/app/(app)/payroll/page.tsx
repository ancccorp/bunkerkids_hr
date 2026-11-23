import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { today } from "@/lib/dates";
import { won } from "@/lib/payroll";
import { Empty, PageShell, StatusBadge } from "@/components/ui";
import { createPayrollRun } from "@/app/actions";

export default async function PayrollPage() {
  const me = await currentUser();
  const mySlips = all<{ id: number; month: string; pay_date: string; net: number; gross: number }>(
    `SELECT p.id, r.month, r.pay_date, p.net, p.gross FROM payslips p JOIN payroll_runs r ON r.id = p.run_id
     WHERE p.user_id = ? AND r.status = 'confirmed' ORDER BY r.month DESC`, me.id);

  const runs =
    me.role === "admin"
      ? all<{ id: number; month: string; pay_date: string; status: string; n: number; gross: number; net: number }>(
          `SELECT r.*, COUNT(p.id) AS n, COALESCE(SUM(p.gross), 0) AS gross, COALESCE(SUM(p.net), 0) AS net
           FROM payroll_runs r LEFT JOIN payslips p ON p.run_id = r.id GROUP BY r.id ORDER BY r.month DESC`)
      : [];

  return (
    <PageShell>
      <h1 className="page-title mb-6">급여</h1>
      {me.role === "admin" && (
        <section className="mb-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">급여 정산</h2>
            <form action={createPayrollRun} className="flex gap-2">
              <input type="month" name="month" defaultValue={today().slice(0, 7)} className="input w-44" required />
              <button className="btn-primary">정산 시작</button>
            </form>
          </div>
          {runs.length === 0 ? (
            <Empty>정산 내역이 없어요. 월을 선택해 급여 대장을 만들어보세요.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
                <thead>
                  <tr>
                    {["귀속월", "지급일", "상태", "인원", "지급 총액", "실지급 총액"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {runs.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/payroll/${r.id}`} className="hover:underline">
                          {r.month}
                        </Link>
                      </td>
                      <td className="px-4">{r.pay_date}</td>
                      <td className="px-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4">{r.n}명</td>
                      <td className="px-4">{won(r.gross)}</td>
                      <td className="px-4 font-semibold">{won(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">내 급여명세서</h2>
        {mySlips.length === 0 ? (
          <Empty>확정된 급여명세서가 없어요</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {mySlips.map((s) => (
              <li key={s.id}>
                <Link href={`/payroll/slip/${s.id}`} className="flex items-center gap-4 py-3 hover:bg-gray-50">
                  <span className="w-24 font-medium">{s.month}</span>
                  <span className="flex-1 text-sm text-gray-500">지급일 {s.pay_date}</span>
                  <span className="text-sm text-gray-500">지급 {won(s.gross)}</span>
                  <span className="w-32 text-right font-semibold">실지급 {won(s.net)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
