"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run, tx } from "@/lib/db";
import { authMode, clearSession, currentUser, requireAdmin, setSession } from "@/lib/auth";
import { nowStamp, today } from "@/lib/dates";
import { annualBalance, documentSteps, findApprover, getDocument, getLeaveRequest, getUser, leaveMinutes } from "@/lib/queries";
import { DEFAULT_SETTINGS, setSetting, type SettingKey } from "@/lib/settings";
import { buildPayslip, certificateSnapshot } from "@/lib/hr";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));

function refreshAll() {
  revalidatePath("/", "layout");
}

// ── 세션 ──────────────────────────────────────────────

export async function devLogin(formData: FormData) {
  if (authMode() !== "dev") throw new Error("개발 모드에서만 사용할 수 있습니다.");
  const user = getUser(num(formData, "userId"));
  if (!user || user.status === "퇴사") throw new Error("구성원을 찾을 수 없습니다.");
  await setSession(user.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

// ── 공지 ──────────────────────────────────────────────

export async function createNotice(formData: FormData) {
  const me = await requireAdmin();
  const title = str(formData, "title");
  const body = str(formData, "body");
  if (!title || !body) throw new Error("제목과 내용을 입력해주세요.");
  const id = run(
    "INSERT INTO notices (title, emoji, category, body, author_id, target, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    title, str(formData, "emoji") || null, str(formData, "category") || "일반", body, me.id, "전체 구성원", nowStamp());
  refreshAll();
  redirect(`/notices?id=${id}`);
}

export async function toggleNoticeHidden(formData: FormData) {
  await requireAdmin();
  run("UPDATE notices SET hidden = 1 - hidden WHERE id = ?", num(formData, "id"));
  refreshAll();
}

export async function toggleReaction(formData: FormData) {
  const me = await currentUser();
  const id = num(formData, "noticeId");
  const emoji = str(formData, "emoji");
  const exists = get("SELECT 1 FROM notice_reactions WHERE notice_id = ? AND user_id = ? AND emoji = ?", id, me.id, emoji);
  if (exists) run("DELETE FROM notice_reactions WHERE notice_id = ? AND user_id = ? AND emoji = ?", id, me.id, emoji);
  else run("INSERT INTO notice_reactions (notice_id, user_id, emoji) VALUES (?, ?, ?)", id, me.id, emoji);
  refreshAll();
}

export async function addComment(formData: FormData) {
  const me = await currentUser();
  const body = str(formData, "body");
  if (!body) return;
  run("INSERT INTO notice_comments (notice_id, user_id, body, created_at) VALUES (?, ?, ?, ?)", num(formData, "noticeId"), me.id, body, nowStamp());
  refreshAll();
}

// ── 휴가 ──────────────────────────────────────────────

export async function requestLeave(formData: FormData) {
  const me = await currentUser();
  const unit = str(formData, "unit") as "day" | "am" | "pm" | "hours";
  const start = str(formData, "start_date");
  const end = unit === "day" ? str(formData, "end_date") || start : start;
  const startTime = unit === "hours" ? str(formData, "start_time") : unit === "am" ? "10:00" : unit === "pm" ? "15:00" : null;
  const endTime = unit === "hours" ? str(formData, "end_time") : unit === "am" ? "14:00" : unit === "pm" ? "19:00" : null;
  if (!start || end < start) throw new Error("날짜를 확인해주세요.");
  if (unit === "hours" && (!startTime || !endTime || endTime <= startTime)) throw new Error("시간을 확인해주세요.");

  const minutes = leaveMinutes(unit, start, end, startTime, endTime);
  if (minutes <= 0) throw new Error("휴가 사용 시간이 0입니다. (주말만 선택했는지 확인해주세요)");

  const approver = findApprover(me.id);
  const autoApprove = approver == null;
  run(
    `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, unit, start_time, end_time, minutes, reason, status, approver_id, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    me.id, num(formData, "leave_type_id"), start, end, unit, startTime, endTime, minutes, str(formData, "reason") || null,
    autoApprove ? "approved" : "pending", approver, nowStamp(), autoApprove ? nowStamp() : null);
  refreshAll();
}

export async function cancelLeave(formData: FormData) {
  const me = await currentUser();
  const req = getLeaveRequest(num(formData, "id"));
  if (!req || (req.user_id !== me.id && me.role !== "admin")) throw new Error("권한이 없습니다.");
  run("UPDATE leave_requests SET status = 'cancelled', decided_at = ? WHERE id = ?", nowStamp(), req.id);
  refreshAll();
}

export async function approveLeave(formData: FormData) {
  return decideLeave(formData, true);
}

export async function rejectLeave(formData: FormData) {
  return decideLeave(formData, false);
}

async function decideLeave(formData: FormData, approve: boolean) {
  const me = await currentUser();
  const req = getLeaveRequest(num(formData, "id"));
  if (!req || req.status !== "pending") return;
  if (req.approver_id !== me.id && me.role !== "admin") throw new Error("결재 권한이 없습니다.");
  run("UPDATE leave_requests SET status = ?, decided_at = ? WHERE id = ?", approve ? "approved" : "rejected", nowStamp(), req.id);
  refreshAll();
}

/** 관리자 연차 수동 조정 (+부여 / -차감). 현재 산정 기간에 적용된다. */
export async function adjustLeave(formData: FormData) {
  const me = await requireAdmin();
  const user = getUser(num(formData, "user_id"));
  const hours = Number(formData.get("hours"));
  const reason = str(formData, "reason");
  if (!user || !hours || !reason) throw new Error("구성원, 시간, 사유를 입력해주세요.");
  const { periodStart } = annualBalance(user);
  run("INSERT INTO leave_adjustments (user_id, period_start, minutes, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    user.id, periodStart, Math.round(hours * 60), reason, me.id, nowStamp());
  refreshAll();
}

// ── 근무 ──────────────────────────────────────────────

export async function saveWorkRecord(formData: FormData) {
  const me = await currentUser();
  const userId = num(formData, "user_id") || me.id;
  if (userId !== me.id && me.role !== "admin") throw new Error("권한이 없습니다.");
  const start = str(formData, "start_time");
  const end = str(formData, "end_time");
  if (!start || !end || end <= start) throw new Error("근무 시간을 확인해주세요.");
  run(
    `INSERT INTO work_records (user_id, date, start_time, end_time) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, date) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time`,
    userId, str(formData, "date"), start, end);
  refreshAll();
}

// ── 구성원 ─────────────────────────────────────────────

export async function saveMember(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  const fields = {
    name: str(formData, "name"),
    title: str(formData, "title") || null,
    email: str(formData, "email"),
    personal_email: str(formData, "personal_email") || null,
    phone: str(formData, "phone") || null,
    employee_no: str(formData, "employee_no") || null,
    join_date: str(formData, "join_date"),
    leave_date: str(formData, "leave_date") || null,
    status: str(formData, "status") || "재직",
    department_id: num(formData, "department_id") || null,
    role: str(formData, "role") === "admin" ? "admin" : "member",
    birth_date: str(formData, "birth_date") || null,
    annual_salary: num(formData, "annual_salary") || null,
    meal_allowance: formData.has("meal_allowance") ? num(formData, "meal_allowance") : 200000,
    dependents: Math.max(1, num(formData, "dependents") || 1),
  };
  if (!fields.name || !fields.email || !fields.join_date) throw new Error("이름, 이메일, 입사일은 필수입니다.");
  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  let userId = id;
  if (id) {
    run(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, ...vals, id);
  } else {
    const palette = ["#f97066", "#9e77ed", "#36bffa", "#fdb022", "#32d583", "#ee46bc", "#6172f3", "#fd853a"];
    userId = run(
      `INSERT INTO users (${cols.join(", ")}, color) VALUES (${cols.map(() => "?").join(", ")}, ?)`,
      ...vals, palette[Math.floor(Math.random() * palette.length)]);
  }
  refreshAll();
  redirect(`/people/${userId}`);
}

// ── 워크플로우 ─────────────────────────────────────────

export async function createDocument(formData: FormData) {
  const me = await currentUser();
  const title = str(formData, "title");
  if (!title) throw new Error("제목을 입력해주세요.");
  const approvers = formData.getAll("approvers").map(Number).filter((x) => x && x !== me.id);
  const unique = [...new Set(approvers)];
  if (unique.length === 0) {
    const a = findApprover(me.id);
    if (a) unique.push(a);
  }
  const id = tx(() => {
    const docId = run(
      "INSERT INTO documents (template, title, body, amount, author_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      str(formData, "template"), title, str(formData, "body"), num(formData, "amount") || null, me.id,
      unique.length ? "pending" : "approved", nowStamp());
    unique.forEach((a, i) =>
      run("INSERT INTO approval_steps (document_id, step, approver_id, status) VALUES (?, ?, ?, ?)", docId, i + 1, a, i === 0 ? "pending" : "waiting"));
    return docId;
  });
  refreshAll();
  redirect(`/workflow/${id}`);
}

export async function approveDocument(formData: FormData) {
  return decideDocument(formData, true);
}

export async function rejectDocument(formData: FormData) {
  return decideDocument(formData, false);
}

async function decideDocument(formData: FormData, approve: boolean) {
  const me = await currentUser();
  const doc = getDocument(num(formData, "id"));
  if (!doc || doc.status !== "pending") return;
  const steps = documentSteps(doc.id);
  const current = steps.find((s) => s.status === "pending");
  if (!current || current.approver_id !== me.id) throw new Error("현재 결재 차례가 아닙니다.");
  tx(() => {
    run("UPDATE approval_steps SET status = ?, comment = ?, decided_at = ? WHERE id = ?",
      approve ? "approved" : "rejected", str(formData, "comment") || null, nowStamp(), current.id);
    if (!approve) {
      run("UPDATE documents SET status = 'rejected' WHERE id = ?", doc.id);
      return;
    }
    const next = steps.find((s) => s.step === current.step + 1);
    if (next) run("UPDATE approval_steps SET status = 'pending' WHERE id = ?", next.id);
    else run("UPDATE documents SET status = 'approved' WHERE id = ?", doc.id);
  });
  refreshAll();
}

export async function cancelDocument(formData: FormData) {
  const me = await currentUser();
  const doc = getDocument(num(formData, "id"));
  if (!doc || doc.author_id !== me.id || doc.status !== "pending") return;
  run("UPDATE documents SET status = 'cancelled' WHERE id = ?", doc.id);
  refreshAll();
}

// ── 인정 ──────────────────────────────────────────────

export async function sendKudos(formData: FormData) {
  const me = await currentUser();
  const to = num(formData, "to_id");
  const message = str(formData, "message");
  if (!to || !message || to === me.id) return;
  run("INSERT INTO kudos (from_id, to_id, emoji, message, created_at) VALUES (?, ?, ?, ?, ?)",
    me.id, to, str(formData, "emoji") || "👏", message, nowStamp());
  refreshAll();
}

// ── 설정 ──────────────────────────────────────────────

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (formData.has(key)) setSetting(key, str(formData, key));
  }
  refreshAll();
}

export async function saveDepartment(formData: FormData) {
  await requireAdmin();
  const id = num(formData, "id");
  const name = str(formData, "name");
  const parent = num(formData, "parent_id") || null;
  const approver = num(formData, "approver_id") || null;
  if (!name) throw new Error("조직 이름을 입력해주세요.");
  if (id && parent === id) throw new Error("자기 자신을 상위 조직으로 지정할 수 없습니다.");
  if (id) run("UPDATE departments SET name = ?, parent_id = ?, approver_id = ? WHERE id = ?", name, parent, approver, id);
  else run("INSERT INTO departments (name, parent_id, approver_id) VALUES (?, ?, ?)", name, parent, approver);
  refreshAll();
}

export async function addHoliday(formData: FormData) {
  await requireAdmin();
  const date = str(formData, "date");
  const name = str(formData, "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) throw new Error("날짜와 이름을 입력해주세요.");
  run("INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET name = excluded.name", date, name);
  refreshAll();
}

export async function deleteHoliday(formData: FormData) {
  await requireAdmin();
  run("DELETE FROM holidays WHERE date = ?", str(formData, "date"));
  refreshAll();
}

// ── 증명서 ─────────────────────────────────────────────

export async function issueCertificate(formData: FormData) {
  const me = await currentUser();
  const type = str(formData, "type") === "career" ? "career" : "employment";
  const purpose = str(formData, "purpose");
  if (!purpose) throw new Error("제출 용도를 입력해주세요.");
  const userId = me.role === "admin" && num(formData, "user_id") ? num(formData, "user_id") : me.id;
  const user = getUser(userId);
  if (!user) throw new Error("구성원을 찾을 수 없습니다.");
  if (type === "employment" && (user.status === "퇴사" || user.join_date > today())) throw new Error("재직증명서는 재직 중인 구성원만 발급할 수 있습니다.");
  const year = today().slice(0, 4);
  const seq = get<{ n: number }>("SELECT COUNT(*) AS n FROM certificates WHERE substr(issued_at, 1, 4) = ?", year)!.n + 1;
  const issueNo = `BK-${year}-${String(seq).padStart(4, "0")}`;
  const id = run("INSERT INTO certificates (user_id, type, purpose, issue_no, snapshot, issued_at) VALUES (?, ?, ?, ?, ?, ?)",
    user.id, type, purpose, issueNo, JSON.stringify(certificateSnapshot(user)), nowStamp());
  refreshAll();
  redirect(`/certificates/${id}`);
}

// ── 전자계약 ───────────────────────────────────────────

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createContract(formData: FormData) {
  const me = await requireAdmin();
  const user = getUser(num(formData, "user_id"));
  const body = str(formData, "body");
  if (!user || !body) throw new Error("구성원과 계약 내용을 입력해주세요.");
  const id = run(
    `INSERT INTO contracts (user_id, template, title, body, annual_salary, status, created_by, created_at, body_hash)
     VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?)`,
    user.id, str(formData, "template"), str(formData, "title"), body, num(formData, "annual_salary") || null, me.id, nowStamp(), sha256(body));
  refreshAll();
  redirect(`/contracts/${id}`);
}

export async function signContract(formData: FormData) {
  const me = await currentUser();
  const c = get<{ id: number; user_id: number; status: string; body: string; body_hash: string; annual_salary: number | null }>(
    "SELECT * FROM contracts WHERE id = ?", num(formData, "id"));
  if (!c || c.user_id !== me.id || c.status !== "sent") throw new Error("서명할 수 없는 계약입니다.");
  if (str(formData, "signer_name") !== me.name) throw new Error("본인 이름을 정확히 입력해주세요.");
  if (formData.get("agree") !== "on") throw new Error("계약 내용에 동의해야 서명할 수 있습니다.");
  if (sha256(c.body) !== c.body_hash) throw new Error("계약 본문이 발송 이후 변경되었습니다. 관리자에게 문의하세요.");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  tx(() => {
    run("UPDATE contracts SET status = 'signed', signed_at = ?, signer_name = ?, signer_ip = ? WHERE id = ?",
      nowStamp(), me.name, sha256(ip), c.id);
    if (c.annual_salary) run("UPDATE users SET annual_salary = ? WHERE id = ?", c.annual_salary, me.id);
  });
  refreshAll();
}

export async function voidContract(formData: FormData) {
  await requireAdmin();
  run("UPDATE contracts SET status = 'void' WHERE id = ? AND status = 'sent'", num(formData, "id"));
  refreshAll();
}

// ── 급여 ──────────────────────────────────────────────

export async function createPayrollRun(formData: FormData) {
  await requireAdmin();
  const month = str(formData, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("정산 월을 선택해주세요.");
  if (get("SELECT 1 FROM payroll_runs WHERE month = ?", month)) throw new Error("이미 생성된 정산 월입니다.");
  const payDay = Number(get<{ value: string }>("SELECT value FROM settings WHERE key = 'pay_day'")?.value ?? DEFAULT_SETTINGS.pay_day);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const payDate = `${month}-${String(Math.min(payDay, lastDay)).padStart(2, "0")}`;
  const id = tx(() => {
    const runId = run("INSERT INTO payroll_runs (month, pay_date, status, created_at) VALUES (?, ?, 'draft', ?)", month, payDate, nowStamp());
    buildPayslip(runId, month);
    return runId;
  });
  refreshAll();
  redirect(`/payroll/${id}`);
}

export async function updatePayslip(formData: FormData) {
  await requireAdmin();
  const slip = get<{ id: number; run_id: number; user_id: number }>("SELECT * FROM payslips WHERE id = ?", num(formData, "id"));
  if (!slip) return;
  const runRow = get<{ month: string; status: string }>("SELECT month, status FROM payroll_runs WHERE id = ?", slip.run_id)!;
  if (runRow.status !== "draft") throw new Error("확정된 급여는 수정할 수 없습니다.");
  run("UPDATE payslips SET extra_pay = ?, extra_deduction = ?, memo = ? WHERE id = ?",
    Math.max(0, num(formData, "extra_pay") || 0), Math.max(0, num(formData, "extra_deduction") || 0), str(formData, "memo") || null, slip.id);
  buildPayslip(slip.run_id, runRow.month, slip.user_id);
  refreshAll();
}

export async function recalcPayroll(formData: FormData) {
  await requireAdmin();
  const r = get<{ id: number; month: string; status: string }>("SELECT * FROM payroll_runs WHERE id = ?", num(formData, "id"));
  if (!r || r.status !== "draft") return;
  tx(() => buildPayslip(r.id, r.month));
  refreshAll();
}

export async function confirmPayroll(formData: FormData) {
  await requireAdmin();
  run("UPDATE payroll_runs SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND status = 'draft'", nowStamp(), num(formData, "id"));
  refreshAll();
}

export async function deletePayrollRun(formData: FormData) {
  await requireAdmin();
  run("DELETE FROM payroll_runs WHERE id = ? AND status = 'draft'", num(formData, "id"));
  refreshAll();
  redirect("/payroll");
}
