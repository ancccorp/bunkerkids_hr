import { requireAdmin } from "@/lib/auth";
import { departmentPath, listDepartments, listHolidays, listUsers } from "@/lib/queries";
import { getSettings, type SettingKey } from "@/lib/settings";
import { fmtDate, today } from "@/lib/dates";
import { PageShell, SubTabs } from "@/components/ui";
import { addHoliday, deleteHoliday, saveDepartment, saveSettings } from "@/app/actions";

const TABS = [
  ["company", "회사·근무"],
  ["leave", "연차"],
  ["payroll", "급여·4대보험"],
  ["org", "조직·결재라인"],
  ["holidays", "공휴일"],
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "company";
  const s = await getSettings();

  const field = (key: SettingKey, label: string, type = "text", hint?: string) => (
    <div>
      <label className="label" htmlFor={key}>
        {label}
      </label>
      <input id={key} name={key} type={type} step="any" defaultValue={s[key]} className="input" />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );

  return (
    <PageShell>
      <h1 className="page-title mb-6">설정</h1>
      <SubTabs items={TABS.map(([k, label]) => ({ href: `/settings?tab=${k}`, label, active: tab === k }))} />
      <div className="mt-6 max-w-3xl">
        {tab === "company" && (
          <form action={saveSettings} className="card space-y-4 p-6">
            <h2 className="font-semibold">회사 정보 (증명서·계약서에 표시)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("company_name", "회사명")}
              {field("company_ceo", "대표자명")}
              {field("company_reg_no", "사업자등록번호")}
              {field("company_address", "주소")}
            </div>
            <h2 className="pt-2 font-semibold">기본 근무시간</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("work_start", "출근", "time")}
              {field("work_end", "퇴근", "time", "휴게 1시간 포함 9시간 → 소정근로 8시간")}
            </div>
            <div className="flex justify-end">
              <button className="btn-primary">저장</button>
            </div>
          </form>
        )}

        {tab === "leave" && (
          <form action={saveSettings} className="card space-y-4 p-6">
            <h2 className="font-semibold">연차 산정 기준</h2>
            {(
              [
                ["hire", "입사일 기준 (법정 원칙)", "각자 입사기념일마다 15일 이상 발생. 법 기준과 같아 퇴사 정산이 필요 없습니다."],
                ["fiscal", "회계연도 기준 (1/1 일괄)", "매년 1월 1일 일괄 부여. 입사 다음 해에는 재직 비율만큼 비례 부여하며, 퇴사 시 입사일 기준보다 적으면 차이를 정산해야 합니다."],
              ] as const
            ).map(([v, label, desc]) => (
              <label key={v} className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40">
                <input type="radio" name="leave_basis" value={v} defaultChecked={s.leave_basis === v} className="mt-1" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className="text-sm text-gray-500">{desc}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-gray-500">
              공통: 1년 미만은 1개월 개근 시 1일(최대 11일), 1년 이상 15일, 3년차부터 2년마다 1일 가산(최대 25일). 1일 = 8시간이며 반차(4시간)·시간 단위 사용 가능.
            </p>
            <div className="flex justify-end">
              <button className="btn-primary">저장</button>
            </div>
          </form>
        )}

        {tab === "payroll" && (
          <form action={saveSettings} className="card space-y-4 p-6">
            {field("pay_day", "급여 지급일 (매월, 당월분)", "number")}
            <h2 className="pt-2 font-semibold">4대보험 근로자 부담 요율 (%)</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("rate_pension", "국민연금", "number", "2026년 총 9.5% 중 근로자 4.75%")}
              {field("rate_health", "건강보험", "number", "2026년 총 7.19% 중 근로자 3.595%")}
              {field("rate_ltc", "장기요양보험 (건강보험료 대비)", "number", "2026년 13.14%")}
              {field("rate_employment", "고용보험 (실업급여)", "number", "근로자 0.9%")}
              {field("pension_min", "국민연금 기준소득월액 하한 (원)", "number")}
              {field("pension_max", "국민연금 기준소득월액 상한 (원)", "number", "매년 7월 변경")}
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              요율은 매년 1월(국민연금 상·하한은 7월) 고시에 맞춰 확인·수정하세요. 산재보험은 전액 회사 부담이라 급여 공제 대상이 아닙니다.
            </p>
            <div className="flex justify-end">
              <button className="btn-primary">저장</button>
            </div>
          </form>
        )}

        {tab === "org" && <OrgSettings />}
        {tab === "holidays" && <HolidaySettings year={Number(sp.year) || Number(today().slice(0, 4))} />}
      </div>
    </PageShell>
  );
}

async function OrgSettings() {
  const depts = await listDepartments();
  const users = await listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] });
  const row = (d?: (typeof depts)[number]) => (
    <form key={d?.id ?? "new"} action={saveDepartment} className="grid items-end gap-2 border-b border-gray-100 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      {d && <input type="hidden" name="id" value={d.id} />}
      <div>
        <label className="label">{d ? departmentPath(d.id, depts).join(" › ") : "새 조직"}</label>
        <input name="name" defaultValue={d?.name} className="input" placeholder="조직 이름" required />
      </div>
      <div>
        <label className="label">상위 조직</label>
        <select name="parent_id" defaultValue={d?.parent_id ?? ""} className="input">
          <option value="">없음 (최상위)</option>
          {depts
            .filter((x) => x.id !== d?.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="label">결재권자</label>
        <select name="approver_id" defaultValue={d?.approver_id ?? ""} className="input">
          <option value="">상위 조직 결재권자</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn-secondary">{d ? "저장" : "추가"}</button>
    </form>
  );
  return (
    <div className="card p-6">
      <h2 className="font-semibold">조직 및 결재라인</h2>
      <p className="mt-1 text-sm text-gray-500">
        휴가·문서의 기본 결재자는 신청자 소속 조직의 결재권자이며, 비어 있거나 본인이면 상위 조직으로 올라갑니다.
      </p>
      {depts.map((d) => row(d))}
      {row()}
    </div>
  );
}

async function HolidaySettings({ year }: { year: number }) {
  const holidays = await listHolidays(year);
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{year}년 공휴일 ({holidays.length}일)</h2>
        <div className="flex gap-1 text-sm">
          <a href={`/settings?tab=holidays&year=${year - 1}`} className="btn-secondary px-2 py-1">
            ‹
          </a>
          <a href={`/settings?tab=holidays&year=${year + 1}`} className="btn-secondary px-2 py-1">
            ›
          </a>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        관공서의 공휴일 규정(대체공휴일 포함) 기준입니다. 임시공휴일·선거일은 정부 발표 시 추가하세요. 공휴일은 근무표와 휴가 일수 계산에서 제외됩니다.
      </p>
      <ul className="mt-4 divide-y divide-gray-100 text-sm">
        {holidays.map((h) => (
          <li key={h.date} className="flex items-center gap-3 py-2">
            <span className="w-40 text-gray-600">{fmtDate(h.date)}</span>
            <span className="flex-1">{h.name}</span>
            <form action={deleteHoliday}>
              <input type="hidden" name="date" value={h.date} />
              <button className="text-xs text-gray-400 hover:text-red-500">삭제</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addHoliday} className="mt-4 flex flex-wrap gap-2">
        <input type="date" name="date" className="input w-44" required />
        <input name="name" className="input flex-1" placeholder="예: 임시공휴일" required />
        <button className="btn-primary">추가</button>
      </form>
    </div>
  );
}
