import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { departmentPath, listDepartments, listUsers } from "@/lib/queries";
import { fmtDate, tenure, today } from "@/lib/dates";
import { Avatar, PageShell, StatusBadge, SubTabs, Tabs } from "@/components/ui";

const ALL_STATUSES = ["재직", "수습", "휴직", "퇴사예정", "퇴사"];

export default async function ManagePeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string | string[] }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const view = sp.view ?? "all";
  const statuses = sp.status ? ([] as string[]).concat(sp.status) : ["재직", "수습", "휴직", "퇴사예정"];
  const t = today();
  const depts = listDepartments();
  let users = listUsers({ statuses: view === "all" ? statuses : undefined, q: sp.q });
  if (view === "joining") users = users.filter((u) => u.join_date > t || u.status === "수습");
  if (view === "leaving") users = users.filter((u) => u.status === "퇴사예정" || u.status === "퇴사");

  const csv = [
    ["이름", "직무", "재직상태", "사번", "입사일", "이메일", "휴대전화", "조직"].join(","),
    ...users.map((u) =>
      [u.name, u.title ?? "", u.status, u.employee_no ?? "", u.join_date, u.email, u.phone ?? "", departmentPath(u.department_id, depts).join(" > ")]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[{ href: "/people/manage", label: "구성원 관리", active: true }, { href: "/people", label: "구성원 목록" }]} />
        <div className="flex gap-2">
          <a
            className="btn-secondary"
            download={`구성원_${t}.csv`}
            href={`data:text/csv;charset=utf-8,﻿${encodeURIComponent(csv)}`}
          >
            CSV 다운로드
          </a>
          <Link href="/people/new" className="btn-primary">
            + 구성원 추가하기
          </Link>
        </div>
      </div>
      <SubTabs
        items={[
          { href: "/people/manage", label: "전체", active: view === "all" },
          { href: "/people/manage?view=joining", label: "입사·수습", active: view === "joining" },
          { href: "/people/manage?view=leaving", label: "퇴사", active: view === "leaving" },
        ]}
      />
      <form className="my-4 flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="view" value={view} />
        {view === "all" &&
          ALL_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
              <input type="checkbox" name="status" value={s} defaultChecked={statuses.includes(s)} /> {s}
            </label>
          ))}
        <input name="q" defaultValue={sp.q} className="input w-48" placeholder="이름, 이메일, 조직 검색" />
        <button className="btn-secondary py-1.5">적용</button>
        <span className="ml-auto text-gray-500">{users.length}명</span>
      </form>

      <div className="table-wrap">
        <table className="w-full min-w-[1100px] whitespace-nowrap text-sm">
          <thead>
            <tr>
              {["이름", "재직 상태", "사번", "입사일", "근속 기간", "이메일", "휴대전화번호", "조직 정보"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/people/${u.id}`} className="flex items-center gap-2.5">
                    <Avatar name={u.name} color={u.color} />
                    <span>
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-gray-500">{u.title}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4">
                  <StatusBadge status={u.join_date > t ? "입사예정" : u.status} />
                </td>
                <td className="px-4 text-gray-600">{u.employee_no}</td>
                <td className="px-4">{fmtDate(u.join_date, false)}</td>
                <td className="px-4">{tenure(u.join_date, t)}</td>
                <td className="px-4 text-gray-600">{u.email}</td>
                <td className="px-4 text-gray-600">{u.phone}</td>
                <td className="px-4 text-gray-600">{departmentPath(u.department_id, depts).join(" › ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
