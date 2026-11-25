import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AUDIT_GROUPS, listAudit } from "@/lib/audit";
import { Empty, PageHeader, PageShell } from "@/components/ui";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  await requireAdmin();
  const { group } = await searchParams;
  const g = group && group in AUDIT_GROUPS ? group : undefined;
  const logs = await listAudit({ limit: 300, group: g });

  return (
    <PageShell>
      <PageHeader
        title="활동 기록"
        description="인사·급여·권한에 영향을 주는 관리 작업이 남아요. 기록은 수정하거나 지울 수 없어요."
        actions={
          <Link href="/admin" className="btn-secondary">
            관리자 센터
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <Link href="/admin/audit" className={!g ? "btn-primary h-8 px-3" : "btn-secondary h-8 px-3"}>
          전체
        </Link>
        {Object.entries(AUDIT_GROUPS).map(([key, label]) => (
          <Link key={key} href={`/admin/audit?group=${key}`} className={g === key ? "btn-primary h-8 px-3" : "btn-secondary h-8 px-3"}>
            {label}
          </Link>
        ))}
      </div>
      {logs.length === 0 ? (
        <Empty>기록이 없어요</Empty>
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                {["시각", "분류", "내용", "처리자"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{l.created_at}</td>
                  <td className="whitespace-nowrap px-4">
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-600">{AUDIT_GROUPS[l.action.split(".")[0]] ?? l.action}</span>
                  </td>
                  <td className="px-4">{l.summary}</td>
                  <td className="whitespace-nowrap px-4 text-ink-600">{l.actor_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logs.length === 300 && <p className="mt-3 text-xs text-ink-400">최근 300건만 보여요. 전체는 관리자 센터에서 CSV로 내려받으세요.</p>}
    </PageShell>
  );
}
