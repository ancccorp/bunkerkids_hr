import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { documentSteps, getDocument } from "@/lib/queries";
import { fmtDate } from "@/lib/dates";
import { PageShell, StatusBadge } from "@/components/ui";
import { approveDocument, cancelDocument, rejectDocument } from "@/app/actions";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  const doc = await getDocument(Number(id));
  if (!doc) notFound();
  const steps = await documentSteps(doc.id);
  const involved = doc.author_id === me.id || steps.some((s) => s.approver_id === me.id) || me.role === "admin";
  if (!involved) notFound();
  const current = steps.find((s) => s.status === "pending");
  const myTurn = doc.status === "pending" && current?.approver_id === me.id;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="rounded-md border border-gray-200 px-2 py-0.5 text-xs">{doc.template}</span>
          <StatusBadge status={doc.status} />
        </div>
        <h1 className="page-title mt-3">{doc.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {doc.author_name} · {fmtDate(doc.created_at.slice(0, 10))}
        </p>

        <section className="card mt-6 p-6">
          {doc.amount != null && (
            <div className="mb-4">
              <div className="text-xs text-gray-400">금액</div>
              <div className="text-xl font-bold">{doc.amount.toLocaleString("ko-KR")}원</div>
            </div>
          )}
          <p className="whitespace-pre-line text-[15px] leading-7">{doc.body || "내용 없음"}</p>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">결재선</h2>
          <ol className="flex flex-wrap items-center gap-2">
            <li className="card px-3 py-2 text-sm">
              <div className="text-xs text-gray-400">기안</div>
              <div className="font-medium">{doc.author_name}</div>
            </li>
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="text-gray-300">→</span>
                <div className={`card px-3 py-2 text-sm ${s.status === "pending" ? "border-amber-300" : ""}`}>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    {s.step}차 <StatusBadge status={s.status} />
                  </div>
                  <div className="font-medium">{s.approver_name}</div>
                  {s.comment && <div className="mt-1 text-xs text-gray-500">“{s.comment}”</div>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {myTurn && (
          <form action={approveDocument} className="card mt-6 space-y-3 p-5">
            <input type="hidden" name="id" value={doc.id} />
            <label className="label">의견 (선택)</label>
            <input name="comment" className="input" />
            <div className="flex justify-end gap-2">
              <button formAction={rejectDocument} className="btn-danger">
                반려
              </button>
              <button className="btn-primary">
                승인
              </button>
            </div>
          </form>
        )}
        {doc.status === "pending" && doc.author_id === me.id && (
          <form action={cancelDocument} className="mt-4 text-right">
            <input type="hidden" name="id" value={doc.id} />
            <button className="text-sm text-gray-400 hover:text-red-500">요청 취소</button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
