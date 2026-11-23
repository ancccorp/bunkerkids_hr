import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { departmentPath, getUser, leaveBalances, listDepartments, listLeaveRequests } from "@/lib/queries";
import { fmtDate, fmtDuration, tenure, today } from "@/lib/dates";
import { Avatar, PageShell, StatusBadge } from "@/components/ui";
import { MemberForm } from "@/components/MemberForm";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  const user = getUser(Number(id));
  if (!user) notFound();
  const depts = listDepartments();
  const isAdmin = me.role === "admin";
  const canSeePrivate = isAdmin || me.id === user.id;
  const year = Number(today().slice(0, 4));
  const annual = leaveBalances(user.id, year).find((b) => b.type.is_annual);
  const leaves = listLeaveRequests({ userId: user.id, year }).slice(0, 5);

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={user.name} color={user.color} size={64} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">{user.name}</h1>
            <StatusBadge status={user.status} />
          </div>
          <p className="text-sm text-gray-500">
            {departmentPath(user.department_id, depts).join(" › ")} {user.title ? `· ${user.title}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <h2 className="mb-4 font-semibold">기본 정보</h2>
          {isAdmin ? (
            <MemberForm user={user} departments={depts} />
          ) : (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["회사 이메일", user.email],
                ["입사일", fmtDate(user.join_date, false)],
                ["근속 기간", tenure(user.join_date)],
                ...(canSeePrivate
                  ? [
                      ["휴대전화번호", user.phone ?? "-"],
                      ["개인 이메일", user.personal_email ?? "-"],
                      ["사번", user.employee_no ?? "-"],
                    ]
                  : []),
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-400">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {canSeePrivate && (
          <section className="card h-fit p-6">
            <h2 className="font-semibold">{year}년 연차</h2>
            {annual && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-gray-400">부여</div>
                  <div className="font-semibold">{fmtDuration(annual.granted ?? 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">사용</div>
                  <div className="font-semibold">{fmtDuration(annual.used)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">잔여</div>
                  <div className={`font-semibold ${(annual.remaining ?? 0) < 0 ? "text-red-500" : "text-brand-600"}`}>
                    {fmtDuration(annual.remaining ?? 0)}
                  </div>
                </div>
              </div>
            )}
            <ul className="mt-5 space-y-2 text-sm">
              {leaves.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <StatusBadge status={l.status} />
                  <span>{l.type_name}</span>
                  <span className="text-gray-500">{fmtDate(l.start_date)}</span>
                  <span className="ml-auto text-xs text-gray-400">{fmtDuration(l.minutes)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}
