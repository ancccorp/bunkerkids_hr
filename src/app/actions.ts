"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run, tx } from "@/lib/db";
import { allowedDomain, authMode, clearSession, currentUser, requireAdmin, setSession } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
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
  const user = await getUser(num(formData, "userId"));
  if (!user || user.status === "퇴사") throw new Error("구성원을 찾을 수 없습니다.");
  await setSession(user.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

// ── 이메일·비밀번호 로그인 (가입 → 관리자 승인) ─────────────

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
// 존재하지 않는 계정에도 같은 시간이 걸리도록 비교에 쓰는 더미 해시
let dummyHash: Promise<string> | undefined;

function requirePasswordMode() {
  if (authMode() !== "password") redirect("/login");
}

export async function passwordLogin(formData: FormData) {
  requirePasswordMode();
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");

  const attempt = await get<{ failures: number; locked_until: string | null }>("SELECT * FROM login_attempts WHERE email = ?", email);
  if (attempt?.locked_until && attempt.locked_until > new Date().toISOString()) redirect("/login?error=locked");

  const user = await get<{ id: number; password_hash: string | null; status: string }>(
    "SELECT id, password_hash, status FROM users WHERE lower(email) = ? AND status != '퇴사'", email);
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex"));
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash));

  if (!user || !user.password_hash || !ok) {
    const failures = (attempt?.failures ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    await run(
      `INSERT INTO login_attempts (email, failures, locked_until) VALUES (?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until`,
      email, lockedUntil ? 0 : failures, lockedUntil);
    // 승인 대기 중인 가입이면 그렇게 알려준다
    if (!user?.password_hash && (await get("SELECT 1 FROM signup_requests WHERE lower(email) = ? AND status = 'pending'", email))) {
      redirect("/login?error=pending");
    }
    redirect(`/login?error=${lockedUntil ? "locked" : "invalid"}`);
  }
  await run("DELETE FROM login_attempts WHERE email = ?", email);
  await setSession(user.id);
  redirect("/");
}

export async function signup(formData: FormData) {
  requirePasswordMode();
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const back = (code: string) => redirect(`/signup?error=${code}`);
  if (!name || !email) back("missing");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back("email");
  const domain = allowedDomain();
  if (domain && !email.endsWith(`@${domain}`)) back("domain");
  if (password !== String(formData.get("password2") ?? "")) back("mismatch");
  if (passwordProblem(password)) back("weak");

  const existing = await get<{ id: number; password_hash: string | null }>(
    "SELECT id, password_hash FROM users WHERE lower(email) = ? AND status != '퇴사'", email);
  if (existing?.password_hash) back("exists");
  const hash = await hashPassword(password);

  // 최초 관리자: 관리자가 한 명도 없고 BOOTSTRAP_ADMIN_EMAIL 이면 승인 없이 바로 관리자
  const bootstrap = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  if (bootstrap && email === bootstrap) {
    const admins = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND password_hash IS NOT NULL"))!.n;
    if (admins === 0) {
      const id = await tx(async () => {
        if (existing) {
          await run("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?", hash, existing.id);
          return existing.id;
        }
        return run("INSERT INTO users (name, email, join_date, status, role, password_hash) VALUES (?, ?, ?, '재직', 'admin', ?)",
          name, email, today(), hash);
      });
      await setSession(id);
      redirect("/");
    }
  }

  // 같은 이메일의 대기 중 요청이 있으면 새 비밀번호로 갱신
  const pending = await get<{ id: number }>("SELECT id FROM signup_requests WHERE lower(email) = ? AND status = 'pending'", email);
  if (pending) await run("UPDATE signup_requests SET name = ?, password_hash = ?, created_at = ? WHERE id = ?", name, hash, nowStamp(), pending.id);
  else await run("INSERT INTO signup_requests (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)", name, email, hash, nowStamp());
  redirect("/signup?done=1");
}

/** 가입 승인: 같은 이메일의 구성원이 있으면 연결, 없으면 새 구성원으로 등록 */
export async function approveSignup(formData: FormData) {
  const me = await requireAdmin();
  const req = await get<{ id: number; name: string; email: string; password_hash: string; status: string }>(
    "SELECT * FROM signup_requests WHERE id = ?", num(formData, "id"));
  if (!req || req.status !== "pending") return;
  await tx(async () => {
    const user = await get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ? AND status != '퇴사'", req.email.toLowerCase());
    if (user) await run("UPDATE users SET password_hash = ? WHERE id = ?", req.password_hash, user.id);
    else
      await run("INSERT INTO users (name, email, join_date, status, role, password_hash) VALUES (?, ?, ?, '재직', 'member', ?)",
        req.name, req.email.toLowerCase(), today(), req.password_hash);
    await run("UPDATE signup_requests SET status = 'approved', decided_at = ?, decided_by = ? WHERE id = ?", nowStamp(), me.id, req.id);
  });
  refreshAll();
}

export async function rejectSignup(formData: FormData) {
  const me = await requireAdmin();
  await run("UPDATE signup_requests SET status = 'rejected', decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'",
    nowStamp(), me.id, num(formData, "id"));
  refreshAll();
}

/** 관리자: 비밀번호 로그인 초기화 (다시 가입 요청 → 승인 필요) */
export async function resetLogin(formData: FormData) {
  const me = await requireAdmin();
  const user = await getUser(num(formData, "user_id"));
  if (!user) return;
  if (user.id === me.id) throw new Error("본인 계정은 비밀번호 변경을 이용해주세요.");
  await run("UPDATE users SET password_hash = NULL WHERE id = ?", user.id);
  await run("DELETE FROM login_attempts WHERE email = ?", user.email.toLowerCase());
  refreshAll();
}

export async function changePassword(formData: FormData) {
  const me = await currentUser();
  const back = (code: string) => redirect(`/people/${me.id}?pw=${code}`);
  const row = await get<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", me.id);
  if (!(await verifyPassword(String(formData.get("current") ?? ""), row?.password_hash))) back("wrong");
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("next2") ?? "")) back("mismatch");
  if (passwordProblem(next)) back("weak");
  await run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(next), me.id);
  back("changed");
}

// ── 공지 ──────────────────────────────────────────────

export async function createNotice(formData: FormData) {
  const me = await requireAdmin();
  const title = str(formData, "title");
  const body = str(formData, "body");
  if (!title || !body) throw new Error("제목과 내용을 입력해주세요.");
  const id = await run(
    "INSERT INTO notices (title, emoji, category, body, author_id, target, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    title, str(formData, "emoji") || null, str(formData, "category") || "일반", body, me.id, "전체 구성원", nowStamp());
  refreshAll();
  redirect(`/notices?id=${id}`);
}

export async function toggleNoticeHidden(formData: FormData) {
  await requireAdmin();
  await run("UPDATE notices SET hidden = 1 - hidden WHERE id = ?", num(formData, "id"));
  refreshAll();
}

export async function toggleReaction(formData: FormData) {
  const me = await currentUser();
  const id = num(formData, "noticeId");
  const emoji = str(formData, "emoji");
  const exists = await get("SELECT 1 FROM notice_reactions WHERE notice_id = ? AND user_id = ? AND emoji = ?", id, me.id, emoji);
  if (exists) await run("DELETE FROM notice_reactions WHERE notice_id = ? AND user_id = ? AND emoji = ?", id, me.id, emoji);
  else await run("INSERT INTO notice_reactions (notice_id, user_id, emoji) VALUES (?, ?, ?)", id, me.id, emoji);
  refreshAll();
}

export async function addComment(formData: FormData) {
  const me = await currentUser();
  const body = str(formData, "body");
  if (!body) return;
  await run("INSERT INTO notice_comments (notice_id, user_id, body, created_at) VALUES (?, ?, ?, ?)", num(formData, "noticeId"), me.id, body, nowStamp());
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

  const minutes = await leaveMinutes(unit, start, end, startTime, endTime);
  if (minutes <= 0) throw new Error("휴가 사용 시간이 0입니다. (주말만 선택했는지 확인해주세요)");

  const approver = await findApprover(me.id);
  const autoApprove = approver == null;
  await run(
    `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, unit, start_time, end_time, minutes, reason, status, approver_id, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    me.id, num(formData, "leave_type_id"), start, end, unit, startTime, endTime, minutes, str(formData, "reason") || null,
    autoApprove ? "approved" : "pending", approver, nowStamp(), autoApprove ? nowStamp() : null);
  refreshAll();
}

export async function cancelLeave(formData: FormData) {
  const me = await currentUser();
  const req = await getLeaveRequest(num(formData, "id"));
  if (!req || (req.user_id !== me.id && me.role !== "admin")) throw new Error("권한이 없습니다.");
  await run("UPDATE leave_requests SET status = 'cancelled', decided_at = ? WHERE id = ?", nowStamp(), req.id);
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
  const req = await getLeaveRequest(num(formData, "id"));
  if (!req || req.status !== "pending") return;
  if (req.approver_id !== me.id && me.role !== "admin") throw new Error("결재 권한이 없습니다.");
  await run("UPDATE leave_requests SET status = ?, decided_at = ? WHERE id = ?", approve ? "approved" : "rejected", nowStamp(), req.id);
  refreshAll();
}

/** 관리자 연차 수동 조정 (+부여 / -차감). 현재 산정 기간에 적용된다. */
export async function adjustLeave(formData: FormData) {
  const me = await requireAdmin();
  const user = await getUser(num(formData, "user_id"));
  const hours = Number(formData.get("hours"));
  const reason = str(formData, "reason");
  if (!user || !hours || !reason) throw new Error("구성원, 시간, 사유를 입력해주세요.");
  const { periodStart } = await annualBalance(user);
  await run("INSERT INTO leave_adjustments (user_id, period_start, minutes, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
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
  await run(
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
    await run(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, ...vals, id);
  } else {
    const palette = ["#f97066", "#9e77ed", "#36bffa", "#fdb022", "#32d583", "#ee46bc", "#6172f3", "#fd853a"];
    userId = await run(
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
    const a = await findApprover(me.id);
    if (a) unique.push(a);
  }
  const id = await tx(async () => {
    const docId = await run(
      "INSERT INTO documents (template, title, body, amount, author_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      str(formData, "template"), title, str(formData, "body"), num(formData, "amount") || null, me.id,
      unique.length ? "pending" : "approved", nowStamp());
    for (const [i, a] of unique.entries())
      await run("INSERT INTO approval_steps (document_id, step, approver_id, status) VALUES (?, ?, ?, ?)", docId, i + 1, a, i === 0 ? "pending" : "waiting");
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
  const doc = await getDocument(num(formData, "id"));
  if (!doc || doc.status !== "pending") return;
  const steps = await documentSteps(doc.id);
  const current = steps.find((s) => s.status === "pending");
  if (!current || current.approver_id !== me.id) throw new Error("현재 결재 차례가 아닙니다.");
  await tx(async () => {
    await run("UPDATE approval_steps SET status = ?, comment = ?, decided_at = ? WHERE id = ?",
      approve ? "approved" : "rejected", str(formData, "comment") || null, nowStamp(), current.id);
    if (!approve) {
      await run("UPDATE documents SET status = 'rejected' WHERE id = ?", doc.id);
      return;
    }
    const next = steps.find((s) => s.step === current.step + 1);
    if (next) await run("UPDATE approval_steps SET status = 'pending' WHERE id = ?", next.id);
    else await run("UPDATE documents SET status = 'approved' WHERE id = ?", doc.id);
  });
  refreshAll();
}

export async function cancelDocument(formData: FormData) {
  const me = await currentUser();
  const doc = await getDocument(num(formData, "id"));
  if (!doc || doc.author_id !== me.id || doc.status !== "pending") return;
  await run("UPDATE documents SET status = 'cancelled' WHERE id = ?", doc.id);
  refreshAll();
}

// ── 인정 ──────────────────────────────────────────────

export async function sendKudos(formData: FormData) {
  const me = await currentUser();
  const to = num(formData, "to_id");
  const message = str(formData, "message");
  if (!to || !message || to === me.id) return;
  await run("INSERT INTO kudos (from_id, to_id, emoji, message, created_at) VALUES (?, ?, ?, ?, ?)",
    me.id, to, str(formData, "emoji") || "👏", message, nowStamp());
  refreshAll();
}

// ── 설정 ──────────────────────────────────────────────

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (formData.has(key)) await setSetting(key, str(formData, key));
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
  if (id) await run("UPDATE departments SET name = ?, parent_id = ?, approver_id = ? WHERE id = ?", name, parent, approver, id);
  else await run("INSERT INTO departments (name, parent_id, approver_id) VALUES (?, ?, ?)", name, parent, approver);
  refreshAll();
}

export async function addHoliday(formData: FormData) {
  await requireAdmin();
  const date = str(formData, "date");
  const name = str(formData, "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) throw new Error("날짜와 이름을 입력해주세요.");
  await run("INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET name = excluded.name", date, name);
  refreshAll();
}

export async function deleteHoliday(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM holidays WHERE date = ?", str(formData, "date"));
  refreshAll();
}

// ── 증명서 ─────────────────────────────────────────────

export async function issueCertificate(formData: FormData) {
  const me = await currentUser();
  const type = str(formData, "type") === "career" ? "career" : "employment";
  const purpose = str(formData, "purpose");
  if (!purpose) throw new Error("제출 용도를 입력해주세요.");
  const userId = me.role === "admin" && num(formData, "user_id") ? num(formData, "user_id") : me.id;
  const user = await getUser(userId);
  if (!user) throw new Error("구성원을 찾을 수 없습니다.");
  if (type === "employment" && (user.status === "퇴사" || user.join_date > today())) throw new Error("재직증명서는 재직 중인 구성원만 발급할 수 있습니다.");
  const year = today().slice(0, 4);
  const seq = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM certificates WHERE substr(issued_at, 1, 4) = ?", year))!.n + 1;
  const issueNo = `BK-${year}-${String(seq).padStart(4, "0")}`;
  const id = await run("INSERT INTO certificates (user_id, type, purpose, issue_no, snapshot, issued_at) VALUES (?, ?, ?, ?, ?, ?)",
    user.id, type, purpose, issueNo, JSON.stringify(await certificateSnapshot(user)), nowStamp());
  refreshAll();
  redirect(`/certificates/${id}`);
}

// ── 전자계약 ───────────────────────────────────────────

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createContract(formData: FormData) {
  const me = await requireAdmin();
  const user = await getUser(num(formData, "user_id"));
  const body = str(formData, "body");
  if (!user || !body) throw new Error("구성원과 계약 내용을 입력해주세요.");
  const id = await run(
    `INSERT INTO contracts (user_id, template, title, body, annual_salary, status, created_by, created_at, body_hash)
     VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?)`,
    user.id, str(formData, "template"), str(formData, "title"), body, num(formData, "annual_salary") || null, me.id, nowStamp(), sha256(body));
  refreshAll();
  redirect(`/contracts/${id}`);
}

export async function signContract(formData: FormData) {
  const me = await currentUser();
  const c = await get<{ id: number; user_id: number; status: string; body: string; body_hash: string; annual_salary: number | null }>(
    "SELECT * FROM contracts WHERE id = ?", num(formData, "id"));
  if (!c || c.user_id !== me.id || c.status !== "sent") throw new Error("서명할 수 없는 계약입니다.");
  if (str(formData, "signer_name") !== me.name) throw new Error("본인 이름을 정확히 입력해주세요.");
  if (formData.get("agree") !== "on") throw new Error("계약 내용에 동의해야 서명할 수 있습니다.");
  if (sha256(c.body) !== c.body_hash) throw new Error("계약 본문이 발송 이후 변경되었습니다. 관리자에게 문의하세요.");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  await tx(async () => {
    await run("UPDATE contracts SET status = 'signed', signed_at = ?, signer_name = ?, signer_ip = ? WHERE id = ?",
      nowStamp(), me.name, sha256(ip), c.id);
    if (c.annual_salary) await run("UPDATE users SET annual_salary = ? WHERE id = ?", c.annual_salary, me.id);
  });
  refreshAll();
}

export async function voidContract(formData: FormData) {
  await requireAdmin();
  await run("UPDATE contracts SET status = 'void' WHERE id = ? AND status = 'sent'", num(formData, "id"));
  refreshAll();
}

// ── 급여 ──────────────────────────────────────────────

export async function createPayrollRun(formData: FormData) {
  await requireAdmin();
  const month = str(formData, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("정산 월을 선택해주세요.");
  if (await get("SELECT 1 FROM payroll_runs WHERE month = ?", month)) throw new Error("이미 생성된 정산 월입니다.");
  const payDay = Number((await get<{ value: string }>("SELECT value FROM settings WHERE key = 'pay_day'"))?.value ?? DEFAULT_SETTINGS.pay_day);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const payDate = `${month}-${String(Math.min(payDay, lastDay)).padStart(2, "0")}`;
  const id = await tx(async () => {
    const runId = await run("INSERT INTO payroll_runs (month, pay_date, status, created_at) VALUES (?, ?, 'draft', ?)", month, payDate, nowStamp());
    await buildPayslip(runId, month);
    return runId;
  });
  refreshAll();
  redirect(`/payroll/${id}`);
}

export async function updatePayslip(formData: FormData) {
  await requireAdmin();
  const slip = await get<{ id: number; run_id: number; user_id: number }>("SELECT * FROM payslips WHERE id = ?", num(formData, "id"));
  if (!slip) return;
  const runRow = (await get<{ month: string; status: string }>("SELECT month, status FROM payroll_runs WHERE id = ?", slip.run_id))!;
  if (runRow.status !== "draft") throw new Error("확정된 급여는 수정할 수 없습니다.");
  await run("UPDATE payslips SET extra_pay = ?, extra_deduction = ?, memo = ? WHERE id = ?",
    Math.max(0, num(formData, "extra_pay") || 0), Math.max(0, num(formData, "extra_deduction") || 0), str(formData, "memo") || null, slip.id);
  await buildPayslip(slip.run_id, runRow.month, slip.user_id);
  refreshAll();
}

export async function recalcPayroll(formData: FormData) {
  await requireAdmin();
  const r = await get<{ id: number; month: string; status: string }>("SELECT * FROM payroll_runs WHERE id = ?", num(formData, "id"));
  if (!r || r.status !== "draft") return;
  await tx(async () => await buildPayslip(r.id, r.month));
  refreshAll();
}

export async function confirmPayroll(formData: FormData) {
  await requireAdmin();
  await run("UPDATE payroll_runs SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND status = 'draft'", nowStamp(), num(formData, "id"));
  refreshAll();
}

export async function deletePayrollRun(formData: FormData) {
  await requireAdmin();
  await run("DELETE FROM payroll_runs WHERE id = ? AND status = 'draft'", num(formData, "id"));
  refreshAll();
  redirect("/payroll");
}
