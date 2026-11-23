import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getNotice, listNotices, noticeComments, noticeReactions } from "@/lib/queries";
import { fmtDate, fmtTime, relative } from "@/lib/dates";
import { Avatar, Empty } from "@/components/ui";
import { addComment, toggleNoticeHidden, toggleReaction } from "../actions";

const REACTIONS = ["👍", "❤️", "🎉", "👀"];

export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string }> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const isAdmin = me.role === "admin";
  const tab = sp.tab === "hidden" && isAdmin ? "hidden" : "all";
  const notices = listNotices(isAdmin).filter((n) => (tab === "hidden" ? n.hidden : !n.hidden));
  const selectedId = Number(sp.id) || notices[0]?.id;
  const selected = selectedId ? getNotice(selectedId) : undefined;
  const visible = selected && (!selected.hidden || isAdmin) ? selected : undefined;
  const reactions = visible ? noticeReactions(visible.id) : [];
  const comments = visible ? noticeComments(visible.id) : [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h1 className="font-semibold">📢 공지</h1>
        {isAdmin && (
          <Link href="/notices/new" className="btn-primary py-1.5">
            공지 추가
          </Link>
        )}
      </header>
      <div className="grid flex-1 md:grid-cols-[minmax(280px,420px)_1fr]">
        <div className="border-b border-gray-200 md:border-b-0 md:border-r">
          <div className="flex gap-4 border-b border-gray-100 px-5 py-3 text-sm">
            <Link href="/notices" className={tab === "all" ? "font-semibold" : "text-gray-400"}>
              전체
            </Link>
            {isAdmin && (
              <Link href="/notices?tab=hidden" className={tab === "hidden" ? "font-semibold" : "text-gray-400"}>
                숨김
              </Link>
            )}
          </div>
          {notices.length === 0 && <Empty>공지가 없어요</Empty>}
          <ul className="divide-y divide-gray-100">
            {notices.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notices?id=${n.id}${tab === "hidden" ? "&tab=hidden" : ""}`}
                  className={`block px-5 py-4 ${n.id === visible?.id ? "bg-gray-50" : "hover:bg-gray-50"}`}
                >
                  <div className="text-sm font-semibold">
                    {n.emoji} [{n.title}] {n.emoji}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {n.author_name} · {n.category} · {relative(n.published_at)}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{n.body.replace(/\s+/g, " ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <article className="min-w-0 px-5 py-8 sm:px-12">
          {!visible ? (
            <Empty>공지를 선택해주세요</Empty>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">{visible.category}</span>
                {isAdmin && (
                  <form action={toggleNoticeHidden}>
                    <input type="hidden" name="id" value={visible.id} />
                    <button className="btn-secondary py-1 text-xs">{visible.hidden ? "다시 게시" : "숨기기"}</button>
                  </form>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                {visible.emoji} [{visible.title}] {visible.emoji}
              </h2>
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-b border-gray-100 pb-6 text-sm">
                <div>
                  <dt className="text-xs text-gray-400">작성자</dt>
                  <dd className="mt-1 flex items-center gap-1.5">
                    <Avatar name={visible.author_name} color={visible.author_color} size={20} /> {visible.author_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">공지 대상</dt>
                  <dd className="mt-1">{visible.target}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">게시일</dt>
                  <dd className="mt-1">
                    {fmtDate(visible.published_at.slice(0, 10))} {fmtTime(visible.published_at.slice(11, 16) || "00:00")}
                  </dd>
                </div>
              </dl>
              <div className="whitespace-pre-line py-8 text-[15px] leading-7">{visible.body}</div>

              <div className="flex flex-wrap gap-2">
                {REACTIONS.map((emoji) => {
                  const r = reactions.find((x) => x.emoji === emoji);
                  const mine = r?.user_ids.split(",").includes(String(me.id));
                  return (
                    <form key={emoji} action={toggleReaction}>
                      <input type="hidden" name="noticeId" value={visible.id} />
                      <input type="hidden" name="emoji" value={emoji} />
                      <button
                        className={`rounded-full border px-2.5 py-0.5 text-sm ${mine ? "border-sky-300 bg-sky-50" : "border-gray-200 hover:bg-gray-50"}`}
                      >
                        {emoji} {r?.count ?? ""}
                      </button>
                    </form>
                  );
                })}
              </div>

              <section className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="mb-3 text-sm font-semibold">댓글 {comments.length}</h3>
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2.5">
                      <Avatar name={c.user_name} color={c.color} size={28} />
                      <div>
                        <div className="text-xs text-gray-500">
                          <b className="text-gray-800">{c.user_name}</b> · {relative(c.created_at)}
                        </div>
                        <p className="whitespace-pre-line text-sm">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <form action={addComment} className="mt-4 flex gap-2">
                  <input type="hidden" name="noticeId" value={visible.id} />
                  <input name="body" className="input" placeholder="댓글을 입력하세요" required />
                  <button className="btn-primary">등록</button>
                </form>
              </section>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
