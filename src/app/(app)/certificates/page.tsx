import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { listUsers } from "@/lib/queries";
import { Empty, PageShell } from "@/components/ui";
import { issueCertificate } from "@/app/actions";

const TYPE_LABEL: Record<string, string> = { employment: "재직증명서", career: "경력증명서" };

export default async function CertificatesPage() {
  const me = await currentUser();
  const isAdmin = me.role === "admin";
  const rows = await all<{ id: number; type: string; purpose: string; issue_no: string; issued_at: string; name: string }>(
    `SELECT c.*, u.name FROM certificates c JOIN users u ON u.id = c.user_id ${isAdmin ? "" : "WHERE c.user_id = ?"} ORDER BY c.id DESC LIMIT 100`,
    ...(isAdmin ? [] : [me.id]),
  );

  return (
    <PageShell>
      <h1 className="page-title mb-6">증명서 발급</h1>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form action={issueCertificate} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">새 증명서</h2>
          {isAdmin && (
            <div>
              <label className="label">대상 구성원 (관리자)</label>
              <select name="user_id" className="input" defaultValue={me.id}>
                {(await listUsers()).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">종류</label>
            <select name="type" className="input">
              <option value="employment">재직증명서</option>
              <option value="career">경력증명서</option>
            </select>
          </div>
          <div>
            <label className="label">제출 용도</label>
            <input name="purpose" className="input" placeholder="예: 금융기관 제출, 비자 발급" required />
          </div>
          <p className="text-xs text-gray-500">발급 즉시 문서 번호가 매겨지고 발급 대장에 기록됩니다. 인쇄 화면에서 PDF로 저장할 수 있어요.</p>
          <button className="btn-primary w-full">발급하기</button>
        </form>

        <section>
          <h2 className="mb-2 text-sm font-semibold">{isAdmin ? "발급 대장" : "내 발급 내역"}</h2>
          {rows.length === 0 ? (
            <Empty>발급 내역이 없어요</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/certificates/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm hover:bg-gray-50">
                    <span className="w-28 font-mono text-xs text-gray-500">{r.issue_no}</span>
                    <span className="font-medium">{TYPE_LABEL[r.type]}</span>
                    {isAdmin && <span>{r.name}</span>}
                    <span className="flex-1 text-gray-500">{r.purpose}</span>
                    <span className="text-xs text-gray-400">{r.issued_at}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
