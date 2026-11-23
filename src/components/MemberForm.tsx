import type { Department, User } from "@/lib/queries";
import { saveMember } from "@/app/actions";

export function MemberForm({ user, departments }: { user?: User; departments: Department[] }) {
  const field = (name: keyof User, label: string, type = "text", required = false) => (
    <div>
      <label className="label">
        {label}
        {required && " *"}
      </label>
      <input name={name} type={type} className="input" defaultValue={(user?.[name] as string) ?? ""} required={required} />
    </div>
  );
  return (
    <form action={saveMember} className="space-y-4">
      {user && <input type="hidden" name="id" value={user.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "이름(닉네임)", "text", true)}
        {field("title", "직무 / 직책")}
        {field("email", "회사 이메일", "email", true)}
        {field("personal_email", "개인 이메일", "email")}
        {field("phone", "휴대전화번호", "tel")}
        {field("employee_no", "사번")}
        {field("join_date", "입사일", "date", true)}
        {field("leave_date", "퇴사(예정)일", "date")}
        {field("birth_date", "생년월일 (증명서용)", "date")}
        <div>
          <label className="label">연봉 (원, 식대 포함)</label>
          <input name="annual_salary" type="number" min={0} step={10000} className="input" defaultValue={user?.annual_salary ?? ""} />
        </div>
        <div>
          <label className="label">월 비과세 식대 (원)</label>
          <input name="meal_allowance" type="number" min={0} step={10000} className="input" defaultValue={user?.meal_allowance ?? 200000} />
        </div>
        <div>
          <label className="label">공제대상 가족 수 (본인 포함)</label>
          <input name="dependents" type="number" min={1} max={11} className="input" defaultValue={user?.dependents ?? 1} />
        </div>
        <div>
          <label className="label">재직 상태</label>
          <select name="status" className="input" defaultValue={user?.status ?? "수습"}>
            {["재직", "수습", "휴직", "퇴사예정", "퇴사"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">조직</label>
          <select name="department_id" className="input" defaultValue={user?.department_id ?? ""}>
            <option value="">미지정</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">권한</label>
          <select name="role" className="input" defaultValue={user?.role ?? "member"}>
            <option value="member">구성원</option>
            <option value="admin">관리자</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary">{user ? "저장" : "추가하기"}</button>
      </div>
    </form>
  );
}
