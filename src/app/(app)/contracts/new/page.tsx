import { requireAdmin } from "@/lib/auth";
import { CONTRACT_TEMPLATES, fillTemplate } from "@/lib/contracts";
import { departmentPath, getUser, listDepartments, listUsers } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { fmtDate, today } from "@/lib/dates";
import { PageShell } from "@/components/ui";
import { createContract } from "@/app/actions";

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ user?: string; template?: string; salary?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const users = await listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] });
  const user = await getUser(Number(sp.user)) ?? users[0];
  const templateKey = sp.template && sp.template in CONTRACT_TEMPLATES ? sp.template : "근로계약서";
  const tpl = CONTRACT_TEMPLATES[templateKey];
  const s = await getSettings();
  const salary = Number(sp.salary) || user?.annual_salary || 0;
  const body = user
    ? fillTemplate(tpl.body, {
        company: s.company_name,
        ceo: s.company_ceo,
        address: s.company_address,
        name: user.name,
        title: user.title ?? "",
        department: departmentPath(user.department_id, await listDepartments()).join(" › "),
        start_date: fmtDate(user.join_date, false),
        annual_salary: salary.toLocaleString("ko-KR"),
        monthly_salary: Math.round(salary / 12).toLocaleString("ko-KR"),
        meal_allowance: user.meal_allowance.toLocaleString("ko-KR"),
        work_start: s.work_start,
        work_end: s.work_end,
        pay_day: s.pay_day,
        today: fmtDate(today(), false),
      })
    : "";

  return (
    <PageShell>
      <h1 className="page-title mb-6">계약서 작성</h1>
      <form className="card mb-4 flex max-w-4xl flex-wrap items-end gap-3 p-5">
        <div>
          <label className="label">구성원</label>
          <select name="user" defaultValue={user?.id} className="input w-48">
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">양식</label>
          <select name="template" defaultValue={templateKey} className="input w-48">
            {Object.keys(CONTRACT_TEMPLATES).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        {tpl.salary && (
          <div>
            <label className="label">연봉 (원)</label>
            <input name="salary" type="number" step={10000} defaultValue={salary || ""} className="input w-44" />
          </div>
        )}
        <button className="btn-secondary">양식 불러오기</button>
      </form>

      {user && (
        <form action={createContract} className="card max-w-4xl space-y-4 p-6">
          <input type="hidden" name="user_id" value={user.id} />
          <input type="hidden" name="template" value={templateKey} />
          {tpl.salary && <input type="hidden" name="annual_salary" value={salary || ""} />}
          <div>
            <label className="label">제목</label>
            <input name="title" defaultValue={`${tpl.title} - ${user.name}`} className="input" required />
          </div>
          <div>
            <label className="label">본문 (발송 후에는 수정할 수 없어요)</label>
            <textarea name="body" defaultValue={body} className="input min-h-[480px] font-mono text-[13px] leading-6" required />
          </div>
          {tpl.salary && (
            <p className="text-xs text-gray-500">서명이 완료되면 구성원의 연봉 정보가 {salary.toLocaleString("ko-KR")}원으로 자동 갱신됩니다.</p>
          )}
          <div className="flex justify-end">
            <button className="btn-primary">{user.name}님에게 서명 요청</button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
