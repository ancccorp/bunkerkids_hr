import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listDocuments, todosFor } from "@/lib/queries";
import { relative } from "@/lib/dates";
import { Empty, PageShell, StatusBadge, SubTabs, Tabs } from "@/components/ui";

export default async function WorkflowPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const view = sp.view ?? "todo";
  const todos = await todosFor(me.id, me.role === "admin");
  const docs = view === "mine" ? await listDocuments({ authorId: me.id }) : view === "all" && me.role === "admin" ? await listDocuments() : await listDocuments({ involving: me.id });

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[{ href: "/workflow", label: "워크플로우", active: true }]} />
        <Link href="/workflow/new" className="btn-primary">
          + 문서 작성
        </Link>
      </div>
      <SubTabs
        items={[
          { href: "/workflow", label: `할 일 ${todos.length}`, active: view === "todo" },
          { href: "/workflow?view=involved", label: "참여 문서", active: view === "involved" },
          { href: "/workflow?view=mine", label: "내가 작성한 문서", active: view === "mine" },
          ...(me.role === "admin" ? [{ href: "/workflow?view=all", label: "전체 문서", active: view === "all" }] : []),
        ]}
      />
      {view === "todo" ? (
        todos.length === 0 ? (
          <Empty>처리할 결재가 없어요 🎉</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todos.map((t) => (
              <li key={`${t.kind}-${t.id}`}>
                <Link href={t.href} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5 hover:bg-gray-50">
                  <span className="w-16 text-sm text-gray-500">{t.from}</span>
                  <span className="flex-1 font-semibold">{t.title}</span>
                  <span className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{t.tag}</span>
                  <span className="w-14 text-right text-xs text-gray-400">{relative(t.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : docs.length === 0 ? (
        <Empty>문서가 없어요</Empty>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/workflow/${d.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5 hover:bg-gray-50">
                <StatusBadge status={d.status} />
                <span className="flex-1 font-semibold">{d.title}</span>
                <span className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{d.template}</span>
                <span className="w-16 text-sm text-gray-500">{d.author_name}</span>
                <span className="w-14 text-right text-xs text-gray-400">{relative(d.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
