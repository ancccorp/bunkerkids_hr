import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { findApprover, getUser, leaveBalances, listLeaveRequests, listLeaveTypes } from "@/lib/queries";
import { addDays, fmtDate, fmtDuration, fmtTime, today } from "@/lib/dates";
import { Empty, PageShell, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { LeaveRequestForm } from "@/components/LeaveRequestForm";
import { cancelLeave } from "@/app/actions";

export default async function TimeOffPage({ searchParams }: { searchParams: Promise<{ year?: string; all?: string }> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const t = today();
  const year = Number(sp.year) || Number(t.slice(0, 4));
  const balances = leaveBalances(me);
  const annual = balances.find((b) => b.annual)!.annual!;
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

      <section className="card mb-8 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">연차 산정 내역</h2>
          <span className="text-xs text-gray-500">
            {annual.basis === "fiscal" ? "회계연도 기준" : "입사일 기준"} · {fmtDate(annual.periodStart, false)} – {fmtDate(addDays(annual.periodEnd, -1), false)} (기간 종료 시 미사용분 소멸)
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center sm:max-w-md">
          {[
            ["발생", annual.granted],
            ["사용·신청", annual.used],
            ["잔여", annual.remaining],
          ].map(([label, m]) => (
            <div key={label as string} className="rounded-lg bg-gray-50 py-3">
              <div className="text-xs text-gray-500">{label}</div>
              <div className={`mt-1 font-semibold ${(m as number) < 0 ? "text-red-500" : ""}`}>{fmtDuration(m as number)}</div>
            </div>
          ))}
        </div>
        <ul className="mt-4 space-y-1 text-sm text-gray-600">
          {annual.lines.map((l) => (
            <li key={l.label} className="flex justify-between border-b border-dashed border-gray-100 py-1">
              <span>{l.label}</span>
              <span>{fmtDuration(l.minutes)}</span>
            </li>
          ))}
          {annual.adjustments !== 0 && (
            <li className="flex justify-between py-1">
              <span>관리자 조정</span>
              <span>{fmtDuration(annual.adjustments)}</span>
            </li>
          )}
          {annual.lines.length === 0 && <li className="text-gray-400">아직 발생한 연차가 없어요. 입사 후 1개월 개근 시 1일이 발생합니다.</li>}
        </ul>
      </section>

      <h2 className="mb-3 text-lg font-bold">휴가 현황</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {shown.map(({ type, remaining, used }) => (
          <div key={type.id} className={`card p-5 ${type.is_annual ? "border-brand-100 bg-brand-50/40" : ""}`}>
            <div className="text-2xl">{type.icon}</div>
            <div className="mt-4 text-sm font-medium">{type.name}</div>
            <div className={`mt-1 text-lg font-semibold ${remaining != null && remaining < 0 ? "text-red-500" : ""}`}>
              {type.is_annual ? `잔여 ${fmtDuration(remaining ?? 0)}` : <span className="text-sm font-normal text-gray-500">{type.description}</span>}
              {!type.is_annual && remaining != null && used > 0 && <span className="block text-xs font-normal text-gray-400">남은 부여량 {fmtDuration(remaining)}</span>}
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
