import { currentUser } from "@/lib/auth";
import { findApprover, listUsers } from "@/lib/queries";
import { PageShell } from "@/components/ui";
import { createDocument } from "@/app/actions";

const TEMPLATES = ["지출결의서(이체요청서)", "비품 구매 요청", "지원금 신청", "계약서 발송 요청", "일반 품의"];

export default async function NewDocumentPage() {
  const me = await currentUser();
  const users = (await listUsers({ statuses: ["재직", "수습"] })).filter((u) => u.id !== me.id);
  const defaultApprover = await findApprover(me.id);

  return (
    <PageShell>
      <h1 className="page-title mb-6">문서 작성</h1>
      <form action={createDocument} className="card max-w-3xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">양식</label>
            <select name="template" className="input">
              {TEMPLATES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">금액 (원, 선택)</label>
            <input name="amount" type="number" min={0} step={1} className="input" placeholder="0" />
          </div>
        </div>
        <div>
          <label className="label">제목 *</label>
          <input name="title" className="input" required />
        </div>
        <div>
          <label className="label">내용</label>
          <textarea name="body" className="input min-h-[200px]" placeholder="요청 배경, 지급처, 계좌, 증빙 등을 적어주세요" />
        </div>
        <fieldset>
          <legend className="label">결재선 (순서대로)</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <select key={i} name="approvers" className="input" defaultValue={i === 0 ? defaultApprover ?? "" : ""}>
                <option value="">{i + 1}차 결재자 {i === 0 ? "" : "(선택)"}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.title ? `· ${u.title}` : ""}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <button className="btn-primary">결재 요청</button>
        </div>
      </form>
    </PageShell>
  );
}
