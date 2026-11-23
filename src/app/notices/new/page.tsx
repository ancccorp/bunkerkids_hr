import { requireAdmin } from "@/lib/auth";
import { PageShell } from "@/components/ui";
import { createNotice } from "../../actions";

export default async function NewNoticePage() {
  await requireAdmin();
  return (
    <PageShell>
      <h1 className="page-title mb-6">공지 추가</h1>
      <form action={createNotice} className="card max-w-3xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-[100px_1fr_160px]">
          <div>
            <label className="label">이모지</label>
            <input name="emoji" className="input" placeholder="📢" maxLength={4} />
          </div>
          <div>
            <label className="label">제목</label>
            <input name="title" className="input" required />
          </div>
          <div>
            <label className="label">카테고리</label>
            <select name="category" className="input">
              {["사내규정", "일반", "복리후생", "행사"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">내용</label>
          <textarea name="body" className="input min-h-[280px]" required />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary">게시하기</button>
        </div>
      </form>
    </PageShell>
  );
}
