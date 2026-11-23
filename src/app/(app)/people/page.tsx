import Link from "next/link";
import { listDepartments, listUsers } from "@/lib/queries";
import { Avatar, PageShell, StatusBadge } from "@/components/ui";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const sp = await searchParams;
  const depts = await listDepartments();
  const deptId = Number(sp.dept) || null;
  // 선택한 조직과 그 하위 조직의 구성원
  const within = new Set<number>();
  if (deptId) {
    const walk = (id: number) => {
      within.add(id);
      depts.filter((d) => d.parent_id === id).forEach((d) => walk(d.id));
    };
    walk(deptId);
  }
  const users = (await listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"], q: sp.q })).filter(
    (u) => !deptId || (u.department_id && within.has(u.department_id)),
  );

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">구성원 <span className="text-gray-400">{users.length}</span></h1>
        <form className="flex gap-2">
          <select name="dept" defaultValue={sp.dept ?? ""} className="input w-36">
            <option value="">전체 조직</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={sp.q} className="input w-48" placeholder="이름, 직무 검색" />
          <button className="btn-secondary">검색</button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {users.map((u) => (
          <Link key={u.id} href={`/people/${u.id}`} className="card flex items-center gap-3 p-4 hover:border-gray-300">
            <Avatar name={u.name} color={u.color} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{u.name}</span>
                {u.status !== "재직" && <StatusBadge status={u.status} />}
              </div>
              <div className="truncate text-xs text-gray-500">
                {u.department_name} {u.title ? `· ${u.title}` : ""}
              </div>
              <div className="truncate text-xs text-gray-400">{u.email}</div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
