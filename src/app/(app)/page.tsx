import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  Heart,
  Inbox,
  Megaphone,
  Palmtree,
  PenLine,
  Users,
} from "lucide-react";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import {
  annualBalance,
  holidayMap,
  listKudos,
  listLeaveRequests,
  listNotices,
  listUsers,
  todosFor,
  weeklySchedule,
} from "@/lib/queries";
import { addDays, fmtDuration, fmtHM, parseISO, relative, startOfWeek, today, WEEKDAYS } from "@/lib/dates";
import { Empty, PageShell, SectionHeader, StatCard } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { sendKudos } from "@/app/actions";

const ACTIVE = ["재직", "수습", "휴직", "퇴사예정"];

export default async function Home() {
  const me = await currentUser();
  const t = today();
  const d = parseISO(t);
  const week = startOfWeek(t);
  const isAdmin = me.role === "admin";

  const todos = await todosFor(me.id, me.role === "admin");
  const signCount = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM contracts WHERE user_id = ? AND status = 'sent'", me.id))!.n;
  const annual = await annualBalance(me);
  const myWeek = (await weeklySchedule([me], week))[0];
  const notices = (await listNotices()).slice(0, 4);
  const kudos = await listKudos(3);
  const users = await listUsers({ statuses: ACTIVE });
  const colleagues = users.filter((u) => u.id !== me.id && u.status !== "휴직");

  // 오늘·이번 주 일정
  const todayOff = (await listLeaveRequests({ from: t, to: t })).filter((l) => l.status === "approved");
  const holidays = [...(await holidayMap(t, addDays(t, 60)))].slice(0, 3);
  const myNext = (await listLeaveRequests({ userId: me.id }))
    .filter((l) => l.end_date >= t && (l.status === "approved" || l.status === "pending"))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const weekHolidays = await holidayMap(days[0], days[6]);
  const weekOff = (await listLeaveRequests({ from: days[0], to: days[6] })).filter((l) => l.status === "approved");
  const plannedMinutes = days.slice(0, 5).filter((x) => !weekHolidays.has(x)).length * 480;

  return (
    <PageShell>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-500">
            {d.getMonth() + 1}월 {d.getDate()}일 {WEEKDAYS[d.getDay()]}요일
          </p>
          <h1 className="page-title mt-1">안녕하세요, {me.name}님</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/time-off" className="btn-secondary">
            <Palmtree size={16} /> 휴가 신청
          </Link>
          <Modal
            trigger={
              <>
                <Heart size={16} /> 동료 인정하기
              </>
            }
            title="동료에게 인정 보내기"
          >
            <form action={sendKudos} className="space-y-4">
              <div>
                <label className="label">받는 사람</label>
                <select name="to_id" className="input" required>
                  {colleagues.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.title ? `· ${u.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">이모지</label>
                <select name="emoji" className="input">
                  {["👏", "🚀", "💪", "🙏", "🎉", "💡"].map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">메시지</label>
                <textarea name="message" className="input" rows={3} required placeholder="고마운 점을 구체적으로 적어주세요" />
              </div>
              <button className="btn-primary w-full">보내기</button>
            </form>
          </Modal>
        </div>
      </div>

      {/* 내 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="잔여 연차"
          value={fmtDuration(annual.remaining)}
          sub={`발생 ${fmtDuration(annual.granted)} · ${annual.periodEnd.slice(2).replace(/-/g, ".")} 소멸`}
          icon={Palmtree}
          tone="violet"
          href="/time-off"
        />
        <StatCard
          label="이번 주 근무"
          value={fmtHM(myWeek.total)}
          sub={`소정 ${fmtHM(plannedMinutes)} 중 ${plannedMinutes ? Math.round((myWeek.total / plannedMinutes) * 100) : 0}%`}
          icon={Clock}
          tone="sky"
          href="/work?view=me"
        />
        <StatCard label="결재할 일" value={`${todos.length}건`} sub={todos[0] ? `${todos[0].from} · ${todos[0].tag}` : "모두 처리했어요"} icon={Inbox} tone="amber" href="/workflow" />
        <StatCard label="서명할 계약" value={`${signCount}건`} sub={signCount ? "확인 후 서명해주세요" : "대기 중인 계약 없음"} icon={PenLine} tone="brand" href="/contracts" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section className="card overflow-hidden">
            <SectionHeader title="해야 할 일" count={todos.length} href="/workflow" />
            {todos.length === 0 && <Empty>처리할 결재가 없어요</Empty>}
            <ul className="divide-y divide-ink-100">
              {todos.slice(0, 5).map((todo) => (
                <li key={`${todo.kind}-${todo.id}`}>
                  <Link href={todo.href} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-ink-50">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{todo.title}</span>
                      <span className="text-xs text-ink-500">
                        {todo.from} · {relative(todo.created_at)}
                      </span>
                    </span>
                    <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-600">{todo.tag}</span>
                    <ChevronRight size={16} className="text-ink-300 group-hover:text-ink-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <SectionHeader title="공지" count={notices.length} href="/notices" />
            {notices.length === 0 && <Empty icon={Megaphone}>공지가 없어요</Empty>}
            <ul className="divide-y divide-ink-100">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link href={`/notices?id=${n.id}`} className="flex gap-4 px-5 py-4 hover:bg-ink-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-lg">{n.emoji ?? "📢"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{n.title}</span>
                      <span className="mt-0.5 block truncate text-sm text-ink-500">{n.body.replace(/\s+/g, " ")}</span>
                      <span className="mt-1 block text-xs text-ink-400">
                        {n.author_name} · {n.category} · {relative(n.published_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title">이번 주</h3>
              <Link href="/work" className="text-xs font-medium text-ink-500 hover:text-ink-900">
                근무표
              </Link>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {days.map((x, i) => {
                const wd = (i + 1) % 7;
                const off = weekOff.filter((l) => l.start_date <= x && l.end_date >= x).length;
                const red = wd === 0 || wd === 6 || weekHolidays.has(x);
                return (
                  <div key={x} title={weekHolidays.get(x)}>
                    <div className={`text-[11px] ${red ? "text-rose-400" : "text-ink-400"}`}>{WEEKDAYS[wd]}</div>
                    <div
                      className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold ${
                        x === t ? "bg-ink-900 text-white" : red ? "text-rose-400" : "text-ink-700"
                      }`}
                    >
                      {Number(x.slice(8))}
                    </div>
                    <div className="mt-1 h-1.5">{off > 0 && <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-leave-500" title={`휴가 ${off}명`} />}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-3 border-t border-ink-100 pt-4 text-sm">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                  <Palmtree size={13} /> 오늘 휴가 {todayOff.length}명
                </div>
                {todayOff.length === 0 ? (
                  <p className="text-ink-400">오늘은 모두 출근해요</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {todayOff.map((l) => (
                      <span key={l.id} className="rounded-full bg-leave-100 px-2.5 py-0.5 text-xs font-medium text-leave-600">
                        {l.user_name} · {l.unit === "day" ? "종일" : l.unit === "am" ? "오전" : l.unit === "pm" ? "오후" : `${l.start_time}~`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {myNext && (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                    <CalendarClock size={13} /> 내 다음 휴가
                  </div>
                  <p>
                    {myNext.start_date.slice(5).replace("-", "/")} {myNext.type_name} · {fmtDuration(myNext.minutes)}
                    {myNext.status === "pending" && <span className="ml-1 text-xs text-amber-600">승인대기</span>}
                  </p>
                </div>
              )}
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                  <CalendarDays size={13} /> 다가오는 공휴일
                </div>
                {holidays.length === 0 && <p className="text-ink-400">60일 안에 공휴일이 없어요</p>}
                {holidays.map(([x, name]) => (
                  <p key={x} className="flex justify-between">
                    <span>{name}</span>
                    <span className="text-ink-500">
                      {x.slice(5).replace("-", "/")} ({WEEKDAYS[parseISO(x).getDay()]})
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h3 className="section-title mb-3">인정과 피드백</h3>
            {kudos.length === 0 ? (
              <p className="text-sm text-ink-500">함께하는 동료들에게 인정 메시지를 보낼 수 있어요.</p>
            ) : (
              <ul className="space-y-3">
                {kudos.map((k) => (
                  <li key={k.id} className="rounded-xl bg-ink-50 p-3.5 text-sm">
                    <div className="text-xs text-ink-500">
                      <span className="mr-1">{k.emoji}</span>
                      {k.from_name} → <b className="text-ink-800">{k.to_name}</b> · {relative(k.created_at)}
                    </div>
                    <p className="mt-1.5 leading-relaxed">{k.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {isAdmin && (
        <Link
          href="/admin"
          className="card mt-8 flex flex-wrap items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Users size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">관리자 센터</span>
            <span className="block text-sm text-ink-500">처리 대기함, 운영 현황, 시스템 점검, 권한, 활동 기록을 한곳에서 확인하세요</span>
          </span>
          <ChevronRight size={18} className="text-ink-400" />
        </Link>
      )}
    </PageShell>
  );
}
