import "server-only";
import { all, get } from "./db";
import { addDays, DAY_MINUTES, eachDay, isWeekend, today, toMinutes, workedMinutes } from "./dates";
import { annualEntitlement, type Entitlement, type LeaveBasis } from "./leave-policy";
import { getSettings } from "./settings";

export type User = {
  id: number;
  name: string;
  title: string | null;
  email: string;
  personal_email: string | null;
  phone: string | null;
  employee_no: string | null;
  join_date: string;
  leave_date: string | null;
  status: string;
  department_id: number | null;
  role: "admin" | "member";
  color: string;
  birth_date: string | null;
  annual_salary: number | null;
  meal_allowance: number;
  dependents: number;
  department_name?: string | null;
};

export type Department = { id: number; name: string; parent_id: number | null; approver_id: number | null };

export type LeaveType = {
  id: number;
  name: string;
  icon: string;
  is_annual: number;
  grant_minutes: number | null;
  description: string;
};

export type LeaveRequest = {
  id: number;
  user_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  unit: "day" | "am" | "pm" | "hours";
  start_time: string | null;
  end_time: string | null;
  minutes: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approver_id: number | null;
  created_at: string;
  decided_at: string | null;
  type_name: string;
  type_icon: string;
  user_name: string;
  approver_name: string | null;
};

export type Notice = {
  id: number;
  title: string;
  emoji: string | null;
  category: string;
  body: string;
  author_id: number;
  author_name: string;
  author_color: string;
  target: string;
  published_at: string;
  hidden: number;
};

export type Document = {
  id: number;
  template: string;
  title: string;
  body: string;
  amount: number | null;
  author_id: number;
  author_name: string;
  status: string;
  created_at: string;
};

export type ApprovalStep = {
  id: number;
  document_id: number;
  step: number;
  approver_id: number;
  approver_name: string;
  status: string;
  comment: string | null;
  decided_at: string | null;
};

// ── 구성원/조직 ─────────────────────────────────────────

const USER_SELECT = `SELECT u.*, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id`;

export function listUsers(opts: { statuses?: string[]; q?: string } = {}) {
  const where: string[] = [];
  const params: string[] = [];
  if (opts.statuses?.length) {
    where.push(`u.status IN (${opts.statuses.map(() => "?").join(",")})`);
    params.push(...opts.statuses);
  }
  if (opts.q) {
    where.push("(u.name LIKE ? OR u.email LIKE ? OR u.title LIKE ? OR d.name LIKE ?)");
    params.push(...Array(4).fill(`%${opts.q}%`));
  }
  return all<User>(`${USER_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY u.name COLLATE NOCASE`, ...params);
}

export function getUser(id: number) {
  return get<User>(`${USER_SELECT} WHERE u.id = ?`, id);
}

export function listDepartments() {
  return all<Department>("SELECT * FROM departments ORDER BY id");
}

/** "벙커키즈 › Business › Operation" */
export function departmentPath(deptId: number | null, depts = listDepartments()) {
  const byId = new Map(depts.map((d) => [d.id, d]));
  const names: string[] = [];
  let cur = deptId ? byId.get(deptId) : undefined;
  while (cur) {
    names.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return names;
}

/** 결재권자 찾기: 소속 조직부터 위로 올라가며 본인이 아닌 첫 결재권자 */
export function findApprover(userId: number): number | null {
  const user = getUser(userId);
  if (!user) return null;
  const depts = listDepartments();
  const byId = new Map(depts.map((d) => [d.id, d]));
  let cur = user.department_id ? byId.get(user.department_id) : undefined;
  while (cur) {
    if (cur.approver_id && cur.approver_id !== userId) return cur.approver_id;
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  // 최상위 결재권자 본인이면 관리자 중 다른 사람, 없으면 자기 자신(자동 승인)
  const admin = get<{ id: number }>("SELECT id FROM users WHERE role = 'admin' AND id != ? ORDER BY id LIMIT 1", userId);
  return admin?.id ?? null;
}

/** 조직 결재권자로 지정된 사람인지 */
export function isApprover(userId: number) {
  return !!get("SELECT 1 FROM departments WHERE approver_id = ?", userId);
}

// ── 휴가 ──────────────────────────────────────────────

export function listLeaveTypes() {
  return all<LeaveType>("SELECT * FROM leave_types ORDER BY id");
}

const LEAVE_SELECT = `
  SELECT r.*, t.name AS type_name, t.icon AS type_icon, u.name AS user_name, a.name AS approver_name
  FROM leave_requests r
  JOIN leave_types t ON t.id = r.leave_type_id
  JOIN users u ON u.id = r.user_id
  LEFT JOIN users a ON a.id = r.approver_id`;

export function listLeaveRequests(opts: { userId?: number; approverId?: number; status?: string; year?: number; from?: string; to?: string } = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.userId) (where.push("r.user_id = ?"), params.push(opts.userId));
  if (opts.approverId) (where.push("r.approver_id = ?"), params.push(opts.approverId));
  if (opts.status) (where.push("r.status = ?"), params.push(opts.status));
  if (opts.year) (where.push("substr(r.start_date, 1, 4) = ?"), params.push(String(opts.year)));
  if (opts.from && opts.to) (where.push("r.start_date <= ? AND r.end_date >= ?"), params.push(opts.to, opts.from));
  return all<LeaveRequest>(`${LEAVE_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY r.start_date DESC, r.id DESC`, ...params);
}

export function getLeaveRequest(id: number) {
  return get<LeaveRequest>(`${LEAVE_SELECT} WHERE r.id = ?`, id);
}

// ── 공휴일 ────────────────────────────────────────────

export function holidayMap(from: string, to: string) {
  return new Map(all<{ date: string; name: string }>("SELECT date, name FROM holidays WHERE date BETWEEN ? AND ?", from, to).map((h) => [h.date, h.name]));
}

export function listHolidays(year: number) {
  return all<{ date: string; name: string }>("SELECT date, name FROM holidays WHERE substr(date, 1, 4) = ? ORDER BY date", String(year));
}

/** 소정근로일: 주말·공휴일이 아닌 날 */
export function workdays(from: string, to: string) {
  const hol = holidayMap(from, to);
  return eachDay(from, to).filter((d) => !isWeekend(d) && !hol.has(d));
}

// ── 연차 ──────────────────────────────────────────────

function annualUsed(userId: number, from: string, to: string) {
  return get<{ m: number }>(
    `SELECT COALESCE(SUM(r.minutes), 0) AS m FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id
     WHERE r.user_id = ? AND t.is_annual = 1 AND r.status IN ('approved','pending') AND r.start_date >= ? AND r.start_date < ?`,
    userId, from, to)!.m;
}

export type AnnualBalance = Entitlement & { adjustments: number; granted: number; used: number; remaining: number; basis: LeaveBasis };

/** 오늘(asOf) 기준 연차 산정 기간의 부여·사용·잔여 */
export function annualBalance(user: Pick<User, "id" | "join_date">, asOf = today()): AnnualBalance {
  const basis = getSettings().leave_basis as LeaveBasis;
  const ent = annualEntitlement(user.join_date, asOf, basis, (from, to) => annualUsed(user.id, from, to));
  const adjustments = get<{ m: number }>(
    "SELECT COALESCE(SUM(minutes), 0) AS m FROM leave_adjustments WHERE user_id = ? AND period_start = ?", user.id, ent.periodStart)!.m;
  const used = annualUsed(user.id, ent.periodStart, ent.periodEnd);
  const granted = ent.minutes + adjustments;
  return { ...ent, adjustments, granted, used, remaining: granted - used, basis };
}

export function listAdjustments(userId: number) {
  return all<{ id: number; period_start: string; minutes: number; reason: string; created_at: string; by_name: string | null }>(
    `SELECT a.*, u.name AS by_name FROM leave_adjustments a LEFT JOIN users u ON u.id = a.created_by WHERE a.user_id = ? ORDER BY a.id DESC`, userId);
}

/** 휴가 유형별 현황. 연차는 정책 산정 기간, 나머지는 올해 사용량 기준. */
export function leaveBalances(user: Pick<User, "id" | "join_date">, asOf = today()) {
  const types = listLeaveTypes();
  const year = asOf.slice(0, 4);
  const used = all<{ leave_type_id: number; minutes: number }>(
    `SELECT leave_type_id, SUM(minutes) AS minutes FROM leave_requests
     WHERE user_id = ? AND status IN ('approved','pending') AND substr(start_date,1,4) = ? GROUP BY leave_type_id`,
    user.id, year);
  const usedBy = new Map(used.map((u) => [u.leave_type_id, u.minutes]));
  const annual = annualBalance(user, asOf);
  return types.map((t) =>
    t.is_annual
      ? { type: t, used: annual.used, granted: annual.granted as number | null, remaining: annual.remaining as number | null, annual }
      : {
          type: t,
          used: usedBy.get(t.id) ?? 0,
          granted: t.grant_minutes,
          remaining: t.grant_minutes == null ? null : t.grant_minutes - (usedBy.get(t.id) ?? 0),
          annual: undefined,
        },
  );
}

/** 신청 단위 → 사용 시간(분). 종일 휴가는 주말·공휴일을 빼고 센다. */
export function leaveMinutes(unit: string, start: string, end: string, startTime?: string | null, endTime?: string | null) {
  if (unit === "am" || unit === "pm") return 4 * 60;
  if (unit === "hours" && startTime && endTime) return Math.max(0, workedMinutes(startTime, endTime));
  return workdays(start, end).length * DAY_MINUTES;
}

// ── 근무 ──────────────────────────────────────────────

export type DayCell = {
  blocks: { kind: "work" | "leave" | "holiday"; label: string; start?: string; end?: string; pending?: boolean }[];
  minutes: number;
};

/** 구성원별 근무표. 기본 근무시간(설정) 위에 근무 기록·휴가·공휴일을 겹쳐 계산한다. */
export function weeklySchedule(users: User[], weekStart: string, numDays = 7) {
  const days = eachDay(weekStart, addDays(weekStart, numDays - 1));
  const weekEnd = days[days.length - 1];
  const settings = getSettings();
  const holidays = holidayMap(weekStart, weekEnd);
  const leaves = listLeaveRequests({ from: weekStart, to: weekEnd }).filter((l) => l.status === "approved" || l.status === "pending");
  const records = all<{ user_id: number; date: string; start_time: string; end_time: string }>(
    "SELECT * FROM work_records WHERE date BETWEEN ? AND ?", weekStart, weekEnd);

  return users.map((u) => {
    let total = 0;
    const cells: DayCell[] = days.map((d) => {
      const cell: DayCell = { blocks: [], minutes: 0 };
      const inactive = u.join_date > d || (u.leave_date && u.leave_date < d) || u.status === "휴직" || u.status === "퇴사";
      if (isWeekend(d) || inactive) return cell;
      if (holidays.has(d)) {
        cell.blocks.push({ kind: "holiday", label: holidays.get(d)! });
        return cell;
      }

      const rec = records.find((r) => r.user_id === u.id && r.date === d);
      const ws = rec?.start_time ?? settings.work_start;
      const we = rec?.end_time ?? settings.work_end;
      const dayLeaves = leaves.filter((l) => l.user_id === u.id && l.start_date <= d && l.end_date >= d);

      const full = dayLeaves.find((l) => l.unit === "day");
      if (full) {
        cell.blocks.push({ kind: "leave", label: `${full.type_name} 하루종일`, pending: full.status === "pending" });
        cell.minutes = DAY_MINUTES;
      } else {
        // 반차/시간 단위 휴가로 근무 구간을 쪼갠다
        const cuts = dayLeaves
          .map((l) => {
            const s = l.unit === "pm" ? "15:00" : l.start_time ?? ws;
            const e = l.unit === "am" ? "14:00" : l.end_time ?? we;
            return { s, e, l };
          })
          .sort((a, b) => a.s.localeCompare(b.s));
        let cursor = ws;
        let leaveMin = 0;
        const segments: DayCell["blocks"] = [];
        for (const c of cuts) {
          if (c.s > cursor) segments.push({ kind: "work", label: "근무", start: cursor, end: c.s });
          segments.push({ kind: "leave", label: c.l.type_name, start: c.s, end: c.e, pending: c.l.status === "pending" });
          leaveMin += c.l.minutes;
          if (c.e > cursor) cursor = c.e;
        }
        if (cursor < we) segments.push({ kind: "work", label: "근무", start: cursor, end: we });
        cell.blocks = segments;
        if (cuts.length === 0) {
          cell.minutes = workedMinutes(ws, we);
        } else {
          // 실제 근무 구간 합 - 휴게 1시간(하루 9시간 이상 체류 시) + 휴가 인정 시간
          const workSpan = segments
            .filter((s) => s.kind === "work")
            .reduce((a, s) => a + toMinutes(s.end!) - toMinutes(s.start!), 0);
          cell.minutes = Math.max(0, workSpan - (workSpan + leaveMin >= 9 * 60 ? 60 : 0)) + leaveMin;
        }
      }
      total += cell.minutes;
      return cell;
    });
    return { user: u, days, cells, total };
  });
}

// ── 공지 ──────────────────────────────────────────────

const NOTICE_SELECT = `SELECT n.*, u.name AS author_name, u.color AS author_color FROM notices n JOIN users u ON u.id = n.author_id`;

export function listNotices(includeHidden = false) {
  return all<Notice>(`${NOTICE_SELECT} ${includeHidden ? "" : "WHERE n.hidden = 0"} ORDER BY n.published_at DESC`);
}

export function getNotice(id: number) {
  return get<Notice>(`${NOTICE_SELECT} WHERE n.id = ?`, id);
}

export function noticeReactions(noticeId: number) {
  return all<{ emoji: string; count: number; user_ids: string }>(
    "SELECT emoji, COUNT(*) AS count, GROUP_CONCAT(user_id) AS user_ids FROM notice_reactions WHERE notice_id = ? GROUP BY emoji", noticeId);
}

export function noticeComments(noticeId: number) {
  return all<{ id: number; body: string; created_at: string; user_name: string; color: string }>(
    `SELECT c.id, c.body, c.created_at, u.name AS user_name, u.color FROM notice_comments c JOIN users u ON u.id = c.user_id
     WHERE c.notice_id = ? ORDER BY c.id`, noticeId);
}

// ── 워크플로우 ─────────────────────────────────────────

const DOC_SELECT = `SELECT d.*, u.name AS author_name FROM documents d JOIN users u ON u.id = d.author_id`;

export function listDocuments(opts: { authorId?: number; involving?: number } = {}) {
  if (opts.authorId) return all<Document>(`${DOC_SELECT} WHERE d.author_id = ? ORDER BY d.id DESC`, opts.authorId);
  if (opts.involving)
    return all<Document>(
      `${DOC_SELECT} WHERE d.author_id = ? OR d.id IN (SELECT document_id FROM approval_steps WHERE approver_id = ?) ORDER BY d.id DESC`,
      opts.involving, opts.involving);
  return all<Document>(`${DOC_SELECT} ORDER BY d.id DESC`);
}

export function getDocument(id: number) {
  return get<Document>(`${DOC_SELECT} WHERE d.id = ?`, id);
}

export function documentSteps(documentId: number) {
  return all<ApprovalStep>(
    `SELECT s.*, u.name AS approver_name FROM approval_steps s JOIN users u ON u.id = s.approver_id WHERE s.document_id = ? ORDER BY s.step`,
    documentId);
}

// ── 할 일 (내가 결재할 항목) ────────────────────────────

export type Todo = { kind: "leave" | "document"; id: number; from: string; title: string; tag: string; created_at: string; href: string };

export function todosFor(userId: number): Todo[] {
  const leaves = listLeaveRequests({ approverId: userId, status: "pending" }).map<Todo>((l) => ({
    kind: "leave",
    id: l.id,
    from: l.user_name,
    title: `'${l.type_name}' 휴가 승인 요청`,
    tag: l.type_name,
    created_at: l.created_at,
    href: "/time-off/manage",
  }));
  const docs = all<Document & { step_id: number }>(
    `${DOC_SELECT} JOIN approval_steps s ON s.document_id = d.id WHERE s.approver_id = ? AND s.status = 'pending' AND d.status = 'pending'`,
    userId).map<Todo>((d) => ({
    kind: "document",
    id: d.id,
    from: d.author_name,
    title: `'${d.title}' 문서 승인 요청`,
    tag: d.template,
    created_at: d.created_at,
    href: `/workflow/${d.id}`,
  }));
  return [...leaves, ...docs].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listKudos(limit = 5) {
  return all<{ id: number; emoji: string; message: string; created_at: string; from_name: string; to_name: string }>(
    `SELECT k.*, f.name AS from_name, t.name AS to_name FROM kudos k JOIN users f ON f.id = k.from_id JOIN users t ON t.id = k.to_id
     ORDER BY k.id DESC LIMIT ?`, limit);
}
