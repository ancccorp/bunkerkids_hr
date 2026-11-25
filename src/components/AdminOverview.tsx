import Link from "next/link";
import { Briefcase, Percent, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import { all, get } from "@/lib/db";
import { annualBalance, listDepartments, listLeaveRequests, type User } from "@/lib/queries";
import { addDays, fmtDuration } from "@/lib/dates";
import { won } from "@/lib/payroll";
import { Avatar, Bar, StatCard } from "@/components/ui";

/** 관리자용 HR 현황 */
export async function AdminOverview({ users, today: t }: { users: User[]; today: string }) {
  const month = t.slice(0, 7);
  const working = users.filter((u) => u.join_date <= t && u.status !== "휴직");
  const probation = users.filter((u) => u.status === "수습");
  const onLeave = users.filter((u) => u.status === "휴직");
  const joining = users.filter((u) => u.join_date.slice(0, 7) === month || u.join_date > t).sort((a, b) => a.join_date.localeCompare(b.join_date));
  const leaving = users.filter((u) => u.status === "퇴사예정" || (u.leave_date && u.leave_date >= t)).sort((a, b) => (a.leave_date ?? "").localeCompare(b.leave_date ?? ""));
  const pendingLeaves = (await listLeaveRequests({ status: "pending" })).length;
  const pendingContracts = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM contracts WHERE status = 'sent'"))!.n;
  const run = await get<{ id: number; status: string; gross: number; net: number }>(
    `SELECT r.id, r.status, COALESCE(SUM(p.gross),0) AS gross, COALESCE(SUM(p.net),0) AS net
     FROM payroll_runs r LEFT JOIN payslips p ON p.run_id = r.id WHERE r.month = ? GROUP BY r.id`, month);

  // 연차 사용률 (현재 산정 기간 기준, 재직 중인 구성원)
  const balances = await Promise.all(working.map((u) => annualBalance(u, t)));
  const granted = balances.reduce((a, b) => a + b.granted, 0);
  const used = balances.reduce((a, b) => a + b.used, 0);
  const lowUse = working
    .map((u, i) => ({ u, b: balances[i] }))
    .filter(({ b }) => b.granted >= 5 * 480 && b.used / b.granted < 0.3)
    .slice(0, 4);

  // 최상위 바로 아래 조직별 인원 (하위 조직 포함)
  const depts = await listDepartments();
  const root = depts.find((x) => x.parent_id == null);
  const groups = depts.filter((x) => x.parent_id === root?.id);
  const topOf = (deptId: number | null): number | null => {
    let cur = depts.find((x) => x.id === deptId);
    while (cur && cur.parent_id != null && cur.parent_id !== root?.id) {
      const parentId: number = cur.parent_id;
      cur = depts.find((x) => x.id === parentId);
    }
    return cur && cur.parent_id === root?.id ? cur.id : null;
  };
  const counts = groups.map((g) => ({ g, n: working.filter((u) => topOf(u.department_id) === g.id).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.n));

  const recentSigned = (await all<{ n: number }>("SELECT COUNT(*) AS n FROM contracts WHERE status = 'signed' AND signed_at >= ?", addDays(t, -30)))[0].n;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">HR 현황</h2>
          <p className="text-sm text-ink-500">관리자에게만 보여요</p>
        </div>
        <Link href="/people/manage" className="text-xs font-medium text-ink-500 hover:text-ink-900">
          구성원 관리 →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="재직 인원" value={`${working.length}명`} sub={`수습 ${probation.length} · 휴직 ${onLeave.length}`} icon={Users} tone="ink" href="/people/manage" />
        <StatCard label="승인 대기 휴가" value={`${pendingLeaves}건`} sub={`서명 대기 계약 ${pendingContracts}건`} icon={Briefcase} tone="amber" href="/time-off/manage" />
        <StatCard
          label="팀 연차 사용률"
          value={`${granted ? Math.round((used / granted) * 100) : 0}%`}
          sub={`${fmtDuration(used)} / ${fmtDuration(granted)}`}
          icon={Percent}
          tone="violet"
          href="/time-off/manage?view=balances"
        />
        <StatCard
          label={`${Number(month.slice(5))}월 급여`}
          value={run ? won(run.net) : "미정산"}
          sub={run ? `${run.status === "confirmed" ? "확정" : "작성중"} · 지급 총액 ${won(run.gross)}` : "급여 대장을 만들어주세요"}
          icon={Wallet}
          tone="brand"
          href={run ? `/payroll/${run.id}` : "/payroll"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="section-title mb-4">조직별 인원</h3>
          <div className="space-y-3">
            {counts.map(({ g, n }) => (
              <Bar key={g.id} label={g.name} value={n} max={maxCount} />
            ))}
            {root && working.some((u) => u.department_id === root.id) && (
              <Bar label={`${root.name} 직속`} value={working.filter((u) => u.department_id === root.id).length} max={maxCount} color="bg-ink-400" />
            )}
          </div>
          <p className="mt-4 text-xs text-ink-400">최근 30일 서명 완료 계약 {recentSigned}건</p>
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">입·퇴사</h3>
          <div className="space-y-2.5 text-sm">
            {joining.slice(0, 4).map((u) => (
              <Link key={u.id} href={`/people/${u.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <UserPlus size={14} />
                </span>
                <span className="flex-1 font-medium">{u.name}</span>
                <span className="text-xs text-ink-500">
                  {u.join_date > t ? "입사 예정" : "입사"} {u.join_date.slice(5).replace("-", "/")}
                </span>
              </Link>
            ))}
            {leaving.slice(0, 4).map((u) => (
              <Link key={u.id} href={`/people/${u.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <UserMinus size={14} />
                </span>
                <span className="flex-1 font-medium">{u.name}</span>
                <span className="text-xs text-ink-500">퇴사 예정 {u.leave_date?.slice(5).replace("-", "/") ?? "-"}</span>
              </Link>
            ))}
            {joining.length + leaving.length === 0 && <p className="text-ink-400">이번 달 입·퇴사가 없어요</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-1">연차 사용 독려 대상</h3>
          <p className="mb-4 text-xs text-ink-500">발생 5일 이상 중 사용률 30% 미만</p>
          <div className="space-y-2.5 text-sm">
            {lowUse.length === 0 && <p className="text-ink-400">모두 고르게 쓰고 있어요</p>}
            {lowUse.map(({ u, b }) => (
              <div key={u.id} className="flex items-center gap-2.5">
                <Avatar name={u.name} color={u.color} size={26} />
                <span className="flex-1 font-medium">{u.name}</span>
                <span className="text-xs text-ink-500">
                  잔여 {fmtDuration(b.remaining)} · {b.periodEnd.slice(2).replace(/-/g, ".")} 소멸
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
