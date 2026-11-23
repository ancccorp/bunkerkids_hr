import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { annualBalance, isApprover, listLeaveRequests, listUsers } from "@/lib/queries";
import { addDays, fmtDate, fmtDuration, fmtTime } from "@/lib/dates";
import { Avatar, Empty, PageShell, StatusBadge, SubTabs } from "@/components/ui";
import { adjustLeave, approveLeave, rejectLeave } from "@/app/actions";
import { Modal } from "@/components/Modal";

export default async function LeaveManagePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const me = await currentUser();
  const isAdmin = me.role === "admin";
  if (!isAdmin && !isApprover(me.id)) redirect("/time-off");
  const sp = await searchParams;
  const view = isAdmin ? sp.view ?? "requests" : "requests";

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">휴가 관리</h1>
        {isAdmin && (
          <Modal trigger="연차 조정" title="연차 수동 조정" triggerClassName="btn-secondary">
            <form action={adjustLeave} className="space-y-3">
              <div>
                <label className="label">구성원</label>
                <select name="user_id" className="input">
                  {listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] }).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">시간 (+부여 / -차감, 1일 = 8시간)</label>
                <input name="hours" type="number" step="0.5" className="input" placeholder="예: 8 또는 -4" required />
              </div>
              <div>
                <label className="label">사유</label>
                <input name="reason" className="input" placeholder="예: 근속 포상휴가, 이전 기간 정산" required />
              </div>
              <p className="text-xs text-gray-500">현재 연차 산정 기간에 적용되며 이력이 남습니다.</p>
              <button className="btn-primary w-full">적용</button>
            </form>
          </Modal>
        )}
      </div>
      {isAdmin && (
      <SubTabs
        items={[
          { href: "/time-off/manage", label: "휴가 신청", active: view === "requests" },
          { href: "/time-off/manage?view=balances", label: "구성원별 연차 현황", active: view === "balances" },
        ]}
      />
      )}
      {view === "requests" ? <Requests myId={me.id} isAdmin={isAdmin} /> : <Balances />}
    </PageShell>
  );
}

function Requests({ myId, isAdmin }: { myId: number; isAdmin: boolean }) {
  // 관리자는 전체, 결재권자는 본인에게 올라온 신청만
  const scope = isAdmin ? {} : { approverId: myId };
  const pending = listLeaveRequests({ ...scope, status: "pending" });
  const recent = listLeaveRequests(scope).filter((r) => r.status !== "pending").slice(0, 20);
  return (
    <>
      <h2 className="mb-2 mt-6 text-sm font-semibold">승인 대기 {pending.length}</h2>
      {pending.length === 0 && <Empty>승인 대기 중인 휴가가 없어요</Empty>}
      <ul className="divide-y divide-gray-100">
        {pending.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <span className="w-20 font-medium">{r.user_name}</span>
            <span>
              {r.type_icon} {r.type_name}
            </span>
            <span className="text-sm text-gray-500">
              {fmtDate(r.start_date)}
              {r.end_date !== r.start_date && ` – ${fmtDate(r.end_date)}`}
              {r.start_time && r.unit !== "day" && ` · ${fmtTime(r.start_time)} – ${fmtTime(r.end_time!)}`}
            </span>
            <span className="rounded bg-leave-100 px-1.5 py-0.5 text-xs text-leave-600">{fmtDuration(r.minutes)}</span>
            {r.reason && <span className="text-xs text-gray-400">“{r.reason}”</span>}
            <span className="ml-auto text-xs text-gray-400">결재자 {r.approver_name}{r.approver_id !== myId && " (관리자 대리결재)"}</span>
            <form action={approveLeave} className="flex gap-1">
              <input type="hidden" name="id" value={r.id} />
              <button formAction={rejectLeave} className="btn-danger py-1 text-xs">
                반려
              </button>
              <button className="btn-primary py-1 text-xs">
                승인
              </button>
            </form>
          </li>
        ))}
      </ul>
      <h2 className="mb-2 mt-8 text-sm font-semibold">최근 처리 내역</h2>
      <ul className="divide-y divide-gray-100 text-sm">
        {recent.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <StatusBadge status={r.status} />
            <span className="w-20 font-medium">{r.user_name}</span>
            <span>{r.type_name}</span>
            <span className="text-gray-500">{fmtDate(r.start_date)}</span>
            <span className="ml-auto text-xs text-gray-400">{fmtDuration(r.minutes)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Balances() {
  const users = listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] });
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            {["이름", "입사일", "산정 기간", "발생", "사용(승인+대기)", "잔여"].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => {
            const a = annualBalance(u);
            return (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/people/${u.id}`} className="flex items-center gap-2">
                    <Avatar name={u.name} color={u.color} size={24} /> {u.name}
                  </Link>
                </td>
                <td className="px-4 text-gray-600">{fmtDate(u.join_date, false)}</td>
                <td className="px-4 text-gray-600">
                  {fmtDate(a.periodStart, false)} – {fmtDate(addDays(a.periodEnd, -1), false)}
                </td>
                <td className="px-4">{fmtDuration(a.granted)}</td>
                <td className="px-4">{fmtDuration(a.used)}</td>
                <td className={`px-4 font-semibold ${a.remaining < 0 ? "text-red-500" : ""}`}>{fmtDuration(a.remaining)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
