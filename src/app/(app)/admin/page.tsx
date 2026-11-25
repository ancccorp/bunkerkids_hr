import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Download,
  FileText,
  History,
  Inbox,
  PenLine,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { all } from "@/lib/db";
import { listDepartments, listLeaveRequests, listUsers } from "@/lib/queries";
import { systemChecks } from "@/lib/health";
import { AUDIT_GROUPS, listAudit } from "@/lib/audit";
import { daysBetween, fmtDate, fmtDuration, today } from "@/lib/dates";
import { Avatar, Empty, PageHeader, PageShell } from "@/components/ui";
import { AdminOverview } from "@/components/AdminOverview";
import { approveLeave, approveSignup, rejectLeave, rejectSignup, setRole } from "@/app/actions";

/** 요청이 들어온 지 며칠 됐는지 (3일 이상이면 강조) */
function Age({ since }: { since: string }) {
  const d = Math.max(0, daysBetween(since.slice(0, 10), today()));
  return (
    <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${d >= 3 ? "bg-red-50 text-red-600" : "bg-ink-100 text-ink-500"}`}>
      {d === 0 ? "오늘" : `${d}일째`}
    </span>
  );
}

function Section({ id, title, icon: Icon, count, children, action }: {
  id: string;
  title: string;
  icon: typeof Inbox;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
        <h2 className="section-title flex items-center gap-2">
          <Icon size={16} className="text-ink-400" /> {title}
          {count != null && <span className="text-ink-400">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminPage() {
  const me = await requireAdmin();
  const t = today();

  const [signups, leaves, docs, contracts, checks, users, depts, logs] = await Promise.all([
    all<{ id: number; name: string; email: string; created_at: string }>(
      "SELECT id, name, email, created_at FROM signup_requests WHERE status = 'pending' ORDER BY id"),
    listLeaveRequests({ status: "pending" }),
    all<{ id: number; title: string; template: string; amount: number | null; created_at: string; author_name: string; approver_name: string; step: number; approver_id: number }>(
      `SELECT d.id, d.title, d.template, d.amount, d.created_at, a.name AS author_name, u.name AS approver_name, s.step, s.approver_id
       FROM documents d JOIN approval_steps s ON s.document_id = d.id AND s.status = 'pending'
       JOIN users a ON a.id = d.author_id JOIN users u ON u.id = s.approver_id
       WHERE d.status = 'pending' ORDER BY d.created_at`),
    all<{ id: number; title: string; created_at: string; name: string }>(
      "SELECT c.id, c.title, c.created_at, u.name FROM contracts c JOIN users u ON u.id = c.user_id WHERE c.status = 'sent' ORDER BY c.created_at"),
    systemChecks(),
    listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] }),
    listDepartments(),
    listAudit({ limit: 12 }),
  ]);
  const pendingTotal = signups.length + leaves.length + docs.length + contracts.length;
  const problems = checks.filter((c) => c.level !== "ok").length;
  const admins = users.filter((u) => u.role === "admin");
  const approvers = depts.filter((d) => d.approver_id);
  const nonAdmins = users.filter((u) => u.role !== "admin" && u.status !== "휴직");

  return (
    <PageShell>
      <PageHeader
        title="관리자 센터"
        description={`처리 대기 ${pendingTotal}건 · 점검 필요 ${problems}건`}
        actions={
          <nav className="flex flex-wrap gap-1.5 text-sm">
            {[
              ["#inbox", "대기함"],
              ["#overview", "현황"],
              ["#checks", "점검"],
              ["#roles", "권한"],
              ["#audit", "기록"],
              ["#export", "내보내기"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="btn-ghost h-8 px-2.5">
                {label}
              </a>
            ))}
          </nav>
        }
      />

      <div className="space-y-6">
        {/* 1. 처리 대기함 */}
        <Section id="inbox" title="처리 대기함" icon={Inbox} count={pendingTotal}>
          {pendingTotal === 0 && <Empty icon={CircleCheck}>모두 처리했어요</Empty>}
          <ul className="divide-y divide-ink-100">
            {signups.map((r) => (
              <li key={`s${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">가입 요청</span>
                <span className="min-w-0 flex-1 text-sm">
                  <b>{r.name}</b> <span className="text-ink-500">{r.email}</span>
                </span>
                <Age since={r.created_at} />
                <form action={approveSignup} className="flex gap-1">
                  <input type="hidden" name="id" value={r.id} />
                  <button formAction={rejectSignup} className="btn-danger h-8 px-2.5 text-xs">
                    거절
                  </button>
                  <button className="btn-primary h-8 px-2.5 text-xs">승인</button>
                </form>
              </li>
            ))}
            {leaves.map((l) => (
              <li key={`l${l.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <span className="rounded-md bg-leave-100 px-1.5 py-0.5 text-[11px] font-semibold text-leave-600">휴가</span>
                <span className="min-w-0 flex-1 text-sm">
                  <b>{l.user_name}</b> {l.type_name} · {fmtDate(l.start_date)}
                  {l.end_date !== l.start_date && ` – ${fmtDate(l.end_date)}`} · {fmtDuration(l.minutes)}
                  <span className="text-ink-400"> · 결재자 {l.approver_name}</span>
                </span>
                <Age since={l.created_at} />
                <form action={approveLeave} className="flex gap-1">
                  <input type="hidden" name="id" value={l.id} />
                  <button formAction={rejectLeave} className="btn-danger h-8 px-2.5 text-xs">
                    반려
                  </button>
                  <button className="btn-primary h-8 px-2.5 text-xs" title={l.approver_id !== me.id ? "관리자 대리 결재로 기록됩니다" : undefined}>
                    승인{l.approver_id !== me.id && " (대리)"}
                  </button>
                </form>
              </li>
            ))}
            {docs.map((d) => (
              <li key={`d${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">결재</span>
                <span className="min-w-0 flex-1 text-sm">
                  <b>{d.title}</b> <span className="text-ink-500">· {d.author_name}</span>
                  {d.amount != null && <span className="text-ink-500"> · {d.amount.toLocaleString("ko-KR")}원</span>}
                  <span className="text-ink-400">
                    {" "}
                    · {d.step}차 {d.approver_name} 결재 차례
                  </span>
                </span>
                <Age since={d.created_at} />
                <Link href={`/workflow/${d.id}`} className={d.approver_id === me.id ? "btn-primary h-8 px-2.5 text-xs" : "btn-secondary h-8 px-2.5 text-xs"}>
                  <FileText size={13} /> {d.approver_id === me.id ? "결재하기" : "보기"}
                </Link>
              </li>
            ))}
            {contracts.map((c) => (
              <li key={`c${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">서명 대기</span>
                <span className="min-w-0 flex-1 text-sm">
                  <b>{c.name}</b> <span className="text-ink-500">{c.title}</span>
                </span>
                <Age since={c.created_at} />
                <Link href={`/contracts/${c.id}`} className="btn-secondary h-8 px-2.5 text-xs">
                  <PenLine size={13} /> 보기
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        {/* 2. 운영 현황 */}
        <div id="overview" className="scroll-mt-6">
          <AdminOverview users={users} today={t} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {/* 3. 시스템 점검표 */}
          <Section id="checks" title="시스템 점검표" icon={ShieldCheck} count={problems || undefined}>
            <ul className="divide-y divide-ink-100">
              {checks.map((c) => {
                const Icon = c.level === "ok" ? CircleCheck : c.level === "warn" ? CircleAlert : CircleX;
                const color = c.level === "ok" ? "text-brand-600" : c.level === "warn" ? "text-amber-500" : "text-red-500";
                const body = (
                  <>
                    <Icon size={17} className={`mt-0.5 shrink-0 ${color}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.label}</span>
                      <span className="block text-xs text-ink-500">{c.detail}</span>
                    </span>
                  </>
                );
                return (
                  <li key={c.label}>
                    {c.href ? (
                      <Link href={c.href} className="flex gap-3 px-5 py-3 hover:bg-ink-50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-3 px-5 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* 4. 권한 관리 */}
          <Section id="roles" title="권한 관리" icon={UserPlus}>
            <div className="space-y-5 p-5">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink-500">관리자 {admins.length}명</h3>
                <ul className="space-y-2">
                  {admins.map((u) => (
                    <li key={u.id} className="flex items-center gap-2.5 text-sm">
                      <Avatar name={u.name} color={u.color} size={26} />
                      <Link href={`/people/${u.id}`} className="flex-1 font-medium hover:underline">
                        {u.name} <span className="font-normal text-ink-500">{u.title}</span>
                      </Link>
                      {admins.length > 1 && (
                        <form action={setRole}>
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="role" value="member" />
                          <button className="text-xs text-ink-400 hover:text-red-500">권한 회수</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
                <form action={setRole} className="mt-3 flex gap-2">
                  <input type="hidden" name="role" value="admin" />
                  <select name="user_id" className="input h-9" aria-label="관리자로 지정할 구성원" required>
                    <option value="">관리자로 지정할 구성원 선택</option>
                    {nonAdmins.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.title ? `· ${u.title}` : ""}
                      </option>
                    ))}
                  </select>
                  <button className="btn-secondary h-9">지정</button>
                </form>
                <p className="mt-2 text-xs text-ink-400">관리자는 급여·연봉·개인정보를 모두 볼 수 있어요. 꼭 필요한 사람만 지정하세요.</p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink-500">결재권자 (조직별)</h3>
                <ul className="space-y-1.5 text-sm">
                  {approvers.map((d) => (
                    <li key={d.id} className="flex justify-between gap-3">
                      <span className="text-ink-600">{d.name}</span>
                      <span className="font-medium">{users.find((u) => u.id === d.approver_id)?.name ?? "(퇴사자)"}</span>
                    </li>
                  ))}
                  {approvers.length === 0 && <li className="text-ink-400">지정된 결재권자가 없어요</li>}
                </ul>
                <Link href="/settings?tab=org" className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                  결재라인 변경 →
                </Link>
              </div>
            </div>
          </Section>
        </div>

        {/* 5. 활동 기록 */}
        <Section
          id="audit"
          title="활동 기록"
          icon={History}
          action={
            <Link href="/admin/audit" className="text-xs font-medium text-ink-500 hover:text-ink-900">
              전체 보기 →
            </Link>
          }
        >
          {logs.length === 0 ? (
            <Empty icon={History}>아직 기록이 없어요. 승인·급여 확정·권한 변경 같은 관리 작업이 여기에 남아요.</Empty>
          ) : (
            <ul className="divide-y divide-ink-100 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
                  <span className="w-32 shrink-0 text-xs text-ink-400">{l.created_at}</span>
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-600">{AUDIT_GROUPS[l.action.split(".")[0]] ?? l.action}</span>
                  <span className="min-w-0 flex-1">{l.summary}</span>
                  <span className="text-xs text-ink-500">{l.actor_name}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* 6. 데이터 내보내기 */}
        <Section id="export" title="데이터 내보내기 (CSV)" icon={Download}>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["/admin/export/members", "구성원 명부", "재직 상태·조직·입사일·연락처"],
              ["/admin/export/leaves", "휴가 기록", "모든 휴가 신청과 결재 결과"],
              [`/admin/export/payroll?month=${t.slice(0, 7)}`, `${Number(t.slice(5, 7))}월 급여 대장`, "항목별 지급·공제 금액"],
              ["/admin/export/audit", "활동 기록", "관리 작업 감사 로그 전체"],
            ].map(([href, label, desc]) => (
              <a key={href} href={href} className="rounded-xl border border-ink-200 p-4 transition hover:border-ink-300 hover:bg-ink-50">
                <Download size={16} className="text-ink-400" />
                <div className="mt-2 text-sm font-semibold">{label}</div>
                <div className="text-xs text-ink-500">{desc}</div>
              </a>
            ))}
          </div>
          <p className="px-5 pb-4 text-xs text-ink-400">개인정보가 들어 있어요. 내려받은 파일은 업무 후 지우고 외부로 보내지 마세요. 내려받기도 활동 기록에 남아요.</p>
        </Section>
      </div>
    </PageShell>
  );
}
