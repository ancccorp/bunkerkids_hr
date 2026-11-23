import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { findApprover, getUser, leaveBalances, listLeaveRequests, listLeaveTypes } from "@/lib/queries";
import { fmtDate, fmtDuration, fmtTime, today } from "@/lib/dates";
import { Empty, PageShell, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { LeaveRequestForm } from "@/components/LeaveRequestForm";
import { cancelLeave } from "../actions";

export default async function TimeOffPage({ searchParams }: { searchParams: Promise<{ year?: string; all?: string }> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const t = today();
  const year = Number(sp.year) || Number(t.slice(0, 4));
  const balances = leaveBalances(me.id, year);
  const types = listLeaveTypes();
  const requests = listLeaveRequests({ userId: me.id, year });
  const upcoming = requests.filter((r) => r.end_date >= t && r.status !== "cancelled" && r.status !== "rejected");
  const past = requests.filter((r) => !upcoming.includes(r));
  const approverId = findApprover(me.id);
  const approverName = approverId ? getUser(approverId)?.name ?? null : null;
  const shown = sp.all ? balances : balances.slice(0, 10);

  const row = (r: (typeof requests)[number], canCancel: boolean) => (
    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <span className="text-xl">{r.type_icon}</span>
      <StatusBadge status={r.status} />
      <span className={`font-medium ${r.status === "cancelled" ? "text-gray-400" : ""}`}>{r.type_name}</span>
      <span className="text-sm text-gray-500">
        {fmtDate(r.start_date)}
        {r.end_date !== r.start_date && ` – ${fmtDate(r.end_date)}`}
        {r.start_time && r.unit !== "day" && ` · ${fmtTime(r.start_time)} – ${fmtTime(r.end_time!)}`}
      </span>
      {r.approver_name && <span className="text-xs text-gray-400">결재: {r.approver_name}</span>}
      <span className="ml-auto rounded bg-leave-100 px-1.5 py-0.5 text-xs text-leave-600">{fmtDuration(r.minutes)}</span>
      {canCancel && (r.status === "pending" || r.status === "approved") && (
        <form action={cancelLeave}>
          <input type="hidden" name="id" value={r.id} />
          <button className="text-xs text-gray-400 hover:text-red-500">취소</button>
        </form>
      )}
    </li>
  );

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">내 휴가</h1>
        <Modal trigger="+ 휴가 신청" title="휴가 신청">
          <LeaveRequestForm types={types} today={t} approverName={approverName} />
        </Modal>
      </div>

      <h2 className="mb-3 text-lg font-bold">휴가 현황</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {shown.map(({ type, remaining, used }) => (
          <div key={type.id} className={`card p-5 ${type.is_annual ? "border-brand-100 bg-brand-50/40" : ""}`}>
            <div className="text-2xl">{type.icon}</div>
            <div className="mt-4 text-sm font-medium">{type.name}</div>
            <div className={`mt-1 text-lg font-semibold ${remaining != null && remaining < 0 ? "text-red-500" : ""}`}>
              {type.is_annual ? `잔여 ${fmtDuration(remaining ?? 0)}` : <span className="text-sm font-normal text-gray-500">{type.description}</span>}
            </div>
            {used > 0 && <div className="mt-1 text-xs text-gray-400">사용 {fmtDuration(used)}</div>}
          </div>
        ))}
      </div>
      {balances.length > 10 && !sp.all && (
        <div className="mt-3 text-center">
          <Link href="/time-off?all=1" className="btn-secondary">
            모두 보기
          </Link>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-bold">사용 기록</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/time-off?year=${year - 1}`} className="btn-secondary px-2 py-1">
            ‹
          </Link>
          <span className="font-semibold">{year}년</span>
          <Link href={`/time-off?year=${year + 1}`} className="btn-secondary px-2 py-1">
            ›
          </Link>
        </div>
      </div>
      <h3 className="mt-4 border-b border-gray-200 pb-2 text-sm font-semibold">
        예정된 휴가 <span className="text-brand-600">{upcoming.length}</span>
      </h3>
      {upcoming.length ? <ul className="divide-y divide-gray-100">{upcoming.map((r) => row(r, true))}</ul> : <Empty>예정된 휴가가 없어요</Empty>}
      <h3 className="mt-6 border-b border-gray-200 pb-2 text-sm font-semibold">
        지난 휴가 <span className="text-brand-600">{past.length}</span>
      </h3>
      {past.length ? <ul className="divide-y divide-gray-100">{past.map((r) => row(r, r.status === "pending"))}</ul> : <Empty>기록이 없어요</Empty>}
    </PageShell>
  );
}
