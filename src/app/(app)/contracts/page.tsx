import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { Empty, PageShell, StatusBadge } from "@/components/ui";
import { CONTRACT_STATUS } from "@/lib/contracts";


export default async function ContractsPage() {
  const me = await currentUser();
  const isAdmin = me.role === "admin";
  const rows = all<{ id: number; title: string; status: string; created_at: string; signed_at: string | null; name: string }>(
    `SELECT c.id, c.title, c.status, c.created_at, c.signed_at, u.name FROM contracts c JOIN users u ON u.id = c.user_id
     ${isAdmin ? "" : "WHERE c.user_id = ? AND c.status != 'void'"} ORDER BY c.id DESC`,
    ...(isAdmin ? [] : [me.id]),
  );
  const waiting = rows.filter((r) => r.status === "sent" && (!isAdmin || r.name === me.name));

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">전자계약</h1>
        {isAdmin && (
          <Link href="/contracts/new" className="btn-primary">
            + 계약서 작성
          </Link>
        )}
      </div>
      {waiting.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          서명할 계약서가 {waiting.length}건 있어요. 내용을 확인하고 서명해주세요.
        </div>
      )}
      {rows.length === 0 ? (
        <Empty>계약서가 없어요</Empty>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/contracts/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5 hover:bg-gray-50">
                <StatusBadge status={r.status === "sent" ? "pending" : r.status === "signed" ? "approved" : "cancelled"} label={CONTRACT_STATUS[r.status]} />
                <span className="flex-1 font-medium">{r.title}</span>
                {isAdmin && <span className="text-sm text-gray-600">{r.name}</span>}
                <span className="text-xs text-gray-400">{r.signed_at ? `서명 ${r.signed_at}` : `발송 ${r.created_at}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
