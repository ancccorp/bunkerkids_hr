"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, run, tx } from "@/lib/db";
import { currentUser, requireAdmin, USER_COOKIE } from "@/lib/auth";
import { annualLeaveDays, DAY_MINUTES, nowStamp, today } from "@/lib/dates";
import { documentSteps, findApprover, getDocument, getLeaveRequest, leaveMinutes } from "@/lib/queries";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));

function refreshAll() {
  revalidatePath("/", "layout");
}

// ── 세션 ──────────────────────────────────────────────

export async function switchUser(formData: FormData) {
  const jar = await cookies();
  jar.set(USER_COOKIE, str(formData, "userId"), { path: "/", httpOnly: true, sameSite: "lax" });
  refreshAll();
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

export async function grantAnnualLeave(formData: FormData) {
  await requireAdmin();
  const year = num(formData, "year");
  const users = all<{ id: number; join_date: string }>(
    "SELECT id, join_date FROM users WHERE status != '퇴사' AND join_date <= ?", today());
  const annual = get<{ id: number }>("SELECT id FROM leave_types WHERE is_annual = 1");
  if (!annual) return;
  tx(() => {
    for (const u of users) {
      run(
        `INSERT INTO leave_grants (user_id, leave_type_id, year, minutes) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, leave_type_id, year) DO UPDATE SET minutes = excluded.minutes`,
        u.id, annual.id, year, annualLeaveDays(u.join_date, year) * DAY_MINUTES);
    }
  });
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
