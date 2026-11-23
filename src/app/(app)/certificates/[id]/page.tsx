import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { fmtDate, tenure, today } from "@/lib/dates";
import type { CertificateSnapshot } from "@/lib/hr";
import { PrintButton } from "@/components/PrintButton";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  const c = get<{ id: number; user_id: number; type: string; purpose: string; issue_no: string; snapshot: string; issued_at: string }>(
    "SELECT * FROM certificates WHERE id = ?", Number(id));
  if (!c || (c.user_id !== me.id && me.role !== "admin")) notFound();
  const s = JSON.parse(c.snapshot) as CertificateSnapshot;
  const employment = c.type === "employment";
  const issued = c.issued_at.slice(0, 10);
  const end = employment ? issued : s.leave_date && s.leave_date <= issued ? s.leave_date : issued;

  const rows: [string, string][] = [
    ["성명", s.name],
    ["생년월일", s.birth_date ? fmtDate(s.birth_date, false) : "-"],
    ["소속", s.department || "-"],
    ["직무/직위", s.title ?? "-"],
    [employment ? "재직기간" : "근무기간", `${fmtDate(s.join_date, false)} ~ ${employment ? "현재" : fmtDate(end, false)} (${tenure(s.join_date, end)})`],
    ["제출 용도", c.purpose],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <article className="print-page card px-10 py-14 sm:px-16">
        <p className="text-xs text-gray-500">문서번호 {c.issue_no}</p>
        <h1 className="my-12 text-center text-3xl font-bold tracking-[0.5em]">{employment ? "재직증명서" : "경력증명서"}</h1>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th className="w-32 border border-gray-300 bg-gray-50 px-4 py-3 text-left font-medium">{k}</th>
                <td className="border border-gray-300 px-4 py-3">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-12 text-center">위와 같이 {employment ? "재직하고 있음" : "근무하였음"}을 증명합니다.</p>
        <p className="mt-10 text-center">{fmtDate(issued, false)}</p>
        <div className="mt-12 space-y-1 text-center">
          <p className="text-lg font-bold">{s.company}</p>
          <p>
            대표이사 {s.ceo} <span className="ml-2 inline-block rounded-full border-2 border-red-400 px-2 py-0.5 text-sm text-red-500">(인)</span>
          </p>
          <p className="text-xs text-gray-500">
            사업자등록번호 {s.reg_no} · {s.address}
          </p>
        </div>
        <p className="mt-10 text-[11px] text-gray-400">
          본 증명서는 {s.company} 인사관리시스템에서 {c.issued_at} 발급되었으며, 문서번호로 발급 사실을 확인할 수 있습니다. (출력일 {today()})
        </p>
      </article>
    </div>
  );
}
