import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { holidayMap, listDepartments, listUsers, weeklySchedule } from "@/lib/queries";
import { addDays, fmtHM, parseISO, startOfWeek, today, WEEKDAYS } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { Avatar, PageShell, Tabs } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { saveWorkRecord } from "@/app/actions";

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string; dept?: string }> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const t = today();
  const week = startOfWeek(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : t);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const mine = sp.view === "me";
  const deptId = Number(sp.dept) || null;
  const depts = listDepartments();
  const settings = getSettings();
  const holidays = holidayMap(week, addDays(week, 6));

  let users = listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] });
  if (mine) users = users.filter((u) => u.id === me.id);
  if (deptId) users = users.filter((u) => u.department_id === deptId || depts.find((d) => d.id === u.department_id)?.parent_id === deptId);
  const rows = weeklySchedule(users, week);
  const leaveCount = new Set(rows.filter((r) => r.cells.some((c) => c.blocks.some((b) => b.kind === "leave"))).map((r) => r.user.id)).size;

  const q = (w: string) => `/work?week=${w}${mine ? "&view=me" : ""}${deptId ? `&dept=${deptId}` : ""}`;
  const d0 = parseISO(week);
  const d6 = parseISO(days[6]);

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { href: `/work?view=me&week=${week}`, label: "내 근무", active: mine },
            { href: `/work?week=${week}`, label: "구성원 근무", active: !mine },
          ]}
        />
        <Modal trigger="근무 기록 수정" title="근무 기록" triggerClassName="btn-secondary">
          <form action={saveWorkRecord} className="space-y-3">
            {me.role === "admin" && (
              <div>
                <label className="label">구성원</label>
                <select name="user_id" className="input" defaultValue={me.id}>
                  {listUsers({ statuses: ["재직", "수습"] }).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">날짜</label>
              <input type="date" name="date" defaultValue={t} className="input" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">출근</label>
                <input type="time" name="start_time" defaultValue={settings.work_start} className="input" required />
              </div>
              <div>
                <label className="label">퇴근</label>
                <input type="time" name="end_time" defaultValue={settings.work_end} className="input" required />
              </div>
            </div>
            <p className="text-xs text-gray-500">휴게시간은 자동 공제됩니다 (4시간 이상 30분, 8시간 이상 1시간).</p>
            <button className="btn-primary w-full">저장</button>
          </form>
        </Modal>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={q(addDays(week, -7))} className="btn-secondary px-2 py-1" aria-label="이전 주">
          ‹
        </Link>
        <span className="font-semibold">
          {d0.getFullYear()}. {d0.getMonth() + 1}. {d0.getDate()} – {d6.getMonth() + 1}. {d6.getDate()}
        </span>
        <Link href={q(addDays(week, 7))} className="btn-secondary px-2 py-1" aria-label="다음 주">
          ›
        </Link>
        <Link href={q(t)} className="btn-secondary py-1">
          오늘
        </Link>
        {!mine && (
          <form className="flex gap-1">
            <input type="hidden" name="week" value={week} />
            <select name="dept" defaultValue={deptId ?? ""} className="input py-1">
              <option value="">전체 조직</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button className="btn-secondary py-1">적용</button>
          </form>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-gray-600">
          <span className="h-3 w-3 rounded-sm bg-leave-500" /> 휴가 {leaveCount}명
        </span>
      </div>

      <div className="table-wrap">
        <table className="w-full min-w-[1000px] table-fixed text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="w-52 px-4 py-3 font-medium text-gray-500">
                {d0.getMonth() + 1}월
              </th>
              {days.map((d, i) => {
                const wk = (i + 1) % 7;
                return (
                  <th key={d} className={`px-2 py-3 font-medium ${wk === 0 || wk === 6 || holidays.has(d) ? "text-red-400" : "text-gray-600"}`}>
                    <span className={d === t ? "rounded bg-red-500 px-1.5 py-0.5 text-white" : ""}>{Number(d.slice(8))}</span> {WEEKDAYS[wk]}
                    {holidays.has(d) && <span className="block truncate text-[11px] font-normal">{holidays.get(d)}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ user, cells, total }) => (
              <tr key={user.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} color={user.color} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{user.name}</div>
                      <div className="truncate text-gray-500">{user.title}</div>
                    </div>
                    <span className="rounded border border-gray-200 px-1.5 py-0.5 text-gray-600">{fmtHM(total)}</span>
                  </div>
                </td>
                {cells.map((c, i) => (
                  <td key={i} className="space-y-1 px-1.5 py-2.5">
                    {c.blocks.map((b, j) =>
                      b.kind === "holiday" ? (
                        <div key={j} className="truncate rounded bg-red-50 px-1.5 py-1 text-red-500">
                          🎌 {b.label}
                        </div>
                      ) : b.kind === "work" ? (
                        <div key={j} title={b.kind === "work" ? `근무 ${b.start}–${b.end}` : undefined} className="truncate rounded border border-gray-300 px-1.5 py-1">
                          <span className="text-gray-400">근무</span> {b.start}–{b.end}
                        </div>
                      ) : (
                        <div
                          key={j}
                          className={`truncate rounded px-1.5 py-1 font-semibold ${b.pending ? "border border-dashed border-leave-500 text-leave-600" : "bg-leave-500 text-white"}`}
                          title={b.pending ? "승인대기" : undefined}
                        >
                          🌴 {b.label} {b.start ? `${b.start}–${b.end}` : ""}
                        </div>
                      ),
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        점선 블록은 승인대기 중인 휴가입니다. 주간 합계는 근무 + 휴가 인정 시간이며, 공휴일은 유급휴일로 근무시간에 포함하지 않습니다. 하루 8시간을 넘는 근무 기록은 급여 정산 시 연장근로로 집계됩니다.
      </p>
    </PageShell>
  );
}
