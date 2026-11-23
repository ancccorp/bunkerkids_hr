import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listKudos, listLeaveRequests, listNotices, listUsers, todosFor } from "@/lib/queries";
import { addDays, fmtDuration, relative, startOfWeek, today, WEEKDAYS } from "@/lib/dates";
import { Avatar, Empty, PageShell, SectionHeader, Tabs } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { sendKudos } from "./actions";

export default async function Home() {
  const me = await currentUser();
  const todos = todosFor(me.id);
  const notices = listNotices().slice(0, 4);
  const kudos = listKudos(3);
  const t = today();
  const week = startOfWeek(t);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i - 1)); // 일요일부터
  const weekLeaves = listLeaveRequests({ from: days[0], to: days[6] }).filter((l) => l.status === "approved");
  const myUpcoming = listLeaveRequests({ userId: me.id }).filter((l) => l.end_date >= t && (l.status === "approved" || l.status === "pending"));
  const colleagues = listUsers({ statuses: ["재직", "수습"] }).filter((u) => u.id !== me.id);

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[{ href: "/", label: "홈 피드", active: true }, { href: "/workflow", label: "할 일" }]} />
        <Modal trigger="💚 동료 인정하기" title="동료에게 인정 보내기">
          <form action={sendKudos} className="space-y-3">
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

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <SectionHeader title={`해야 할 일 (${todos.length})`} href="/workflow" />
            {todos.length === 0 && <Empty>처리할 결재가 없어요 🎉</Empty>}
            <ul className="divide-y divide-gray-100">
              {todos.slice(0, 5).map((todo) => (
                <li key={`${todo.kind}-${todo.id}`}>
                  <Link href={todo.href} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-gray-50">
                    <span className="w-16 text-sm text-gray-500">{todo.from}</span>
                    <span className="flex-1 text-sm font-semibold">○ {todo.title}</span>
                    <span className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{todo.tag}</span>
                    <span className="w-14 text-right text-xs text-gray-400">{relative(todo.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <SectionHeader title={`공지 (${notices.length})`} href="/notices" />
            {notices.length === 0 && <Empty>공지가 없어요</Empty>}
            <ul className="divide-y divide-gray-100">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link href={`/notices?id=${n.id}`} className="block px-5 py-4 hover:bg-gray-50">
                    <div className="font-semibold">
                      {n.emoji} [{n.title}] {n.emoji}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <Avatar name={n.author_name} color={n.author_color} size={16} />
                      {n.author_name} · {n.category} · {relative(n.published_at)}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">{n.body.replace(/\s+/g, " ")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h3 className="text-sm text-gray-500">인정과 피드백</h3>
            {kudos.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">함께하는 동료들에게 인정 메시지를 보낼 수 있어요.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {kudos.map((k) => (
                  <li key={k.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                    <div className="text-xs text-gray-500">
                      {k.emoji} {k.from_name} → <b className="text-gray-800">{k.to_name}</b> · {relative(k.created_at)}
                    </div>
                    <p className="mt-1">{k.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">
                {Number(t.slice(0, 4))}년 {Number(t.slice(5, 7))}월
              </h3>
              <Link href="/work" className="text-xs text-gray-500 hover:text-gray-800">
                근무 보기
              </Link>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-gray-400">
              {days.map((d, i) => (
                <div key={d}>
                  <div>{WEEKDAYS[i]}</div>
                  <div
                    className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                      d === t ? "bg-brand-50 font-bold text-brand-600" : i === 0 || i === 6 ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              {myUpcoming.slice(0, 3).map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-md bg-leave-100 px-2 py-1 text-leave-600">
                  {l.type_icon} 내 {l.type_name} · {l.start_date.slice(5).replace("-", "/")} · {fmtDuration(l.minutes)}
                  {l.status === "pending" && " (승인대기)"}
                </div>
              ))}
              {weekLeaves.length > 0 && (
                <div className="pt-1 text-gray-500">
                  이번 주 휴가: {[...new Set(weekLeaves.map((l) => l.user_name))].join(", ")}
                </div>
              )}
              {myUpcoming.length === 0 && weekLeaves.length === 0 && <div className="py-3 text-center text-gray-400">일정이 없어요.</div>}
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
