import { notFound } from "next/navigation";
import { authMode, currentUser } from "@/lib/auth";
import { changePassword, resetLogin } from "@/app/actions";
import { annualBalance, departmentPath, getUser, listAdjustments, listDepartments, listLeaveRequests } from "@/lib/queries";
import { fmtDate, fmtDuration, tenure, today } from "@/lib/dates";
import { Avatar, PageShell, StatusBadge } from "@/components/ui";
import { MemberForm } from "@/components/MemberForm";

const PW_MSG: Record<string, [string, boolean]> = {
  changed: ["비밀번호를 바꿨어요.", true],
  wrong: ["현재 비밀번호가 맞지 않아요.", false],
  mismatch: ["새 비밀번호 확인이 일치하지 않아요.", false],
  weak: ["비밀번호는 8자 이상, 영문과 숫자를 모두 넣어주세요.", false],
};

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pw?: string }> }) {
  const { id } = await params;
  const { pw } = await searchParams;
  const me = await currentUser();
  const user = await getUser(Number(id));
  if (!user) notFound();
  const depts = await listDepartments();
  const isAdmin = me.role === "admin";
  const canSeePrivate = isAdmin || me.id === user.id;
  const year = Number(today().slice(0, 4));
  const annual = await annualBalance(user);
  const adjustments = isAdmin ? await listAdjustments(user.id) : [];
  const leaves = (await listLeaveRequests({ userId: user.id, year })).slice(0, 5);

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
            <h2 className="font-semibold">연차 ({fmtDate(annual.periodStart, false)} ~)</h2>
            {annual && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-gray-400">부여</div>
                  <div className="font-semibold">{fmtDuration(annual.granted)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">사용</div>
                  <div className="font-semibold">{fmtDuration(annual.used)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">잔여</div>
                  <div className={`font-semibold ${annual.remaining < 0 ? "text-red-500" : "text-brand-600"}`}>
                    {fmtDuration(annual.remaining)}
                  </div>
                </div>
              </div>
            )}
            {adjustments.length > 0 && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                <div className="mb-1 font-semibold">조정 이력</div>
                {adjustments.map((a) => (
                  <div key={a.id}>
                    {a.created_at.slice(0, 10)} · {a.minutes > 0 ? "+" : ""}
                    {fmtDuration(a.minutes)} · {a.reason} ({a.by_name})
                  </div>
                ))}
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

      {authMode() === "password" && (me.id === user.id || isAdmin) && (
        <section className="card mt-6 max-w-3xl p-6">
          <h2 className="font-semibold">로그인 계정</h2>
          <p className="mt-1 text-sm text-ink-500">
            {user.email} · {user.has_login ? "비밀번호 로그인 사용 중" : "로그인 계정 없음 (회원가입 후 승인 필요)"}
          </p>
          {pw && PW_MSG[pw] && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${PW_MSG[pw][1] ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"}`}>{PW_MSG[pw][0]}</p>
          )}
          {me.id === user.id ? (
            <form action={changePassword} className="mt-4 grid gap-3 sm:grid-cols-3">
              <input name="current" type="password" className="input" placeholder="현재 비밀번호" autoComplete="current-password" required />
              <input name="next" type="password" className="input" placeholder="새 비밀번호 (8자 이상, 영문+숫자)" autoComplete="new-password" minLength={8} required />
              <input name="next2" type="password" className="input" placeholder="새 비밀번호 확인" autoComplete="new-password" minLength={8} required />
              <div className="sm:col-span-3">
                <button className="btn-secondary">비밀번호 변경</button>
              </div>
            </form>
          ) : (
            user.has_login && (
              <form action={resetLogin} className="mt-4">
                <input type="hidden" name="user_id" value={user.id} />
                <button className="btn-danger">로그인 초기화</button>
                <p className="mt-2 text-xs text-ink-500">비밀번호를 지워요. 본인이 다시 회원가입하고 승인을 받아야 로그인할 수 있어요.</p>
              </form>
            )
          )}
        </section>
      )}
    </PageShell>
  );
}
