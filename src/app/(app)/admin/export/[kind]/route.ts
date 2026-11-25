import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { audit } from "@/lib/audit";
import { departmentPath, listDepartments, listLeaveRequests, listUsers } from "@/lib/queries";
import type { PayDetail } from "@/lib/payroll";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** 셀 하나: 따옴표 이스케이프 + 엑셀 수식 주입 방지 (=, +, -, @ 로 시작하면 ' 붙임) */
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function csv(rows: unknown[][]) {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

const LEAVE_STATUS: Record<string, string> = { pending: "승인대기", approved: "승인", rejected: "반려", cancelled: "취소" };

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await sessionUser();
  if (!me || me.role !== "admin") return new NextResponse("권한이 없습니다.", { status: 403 });
  const { kind } = await params;
  const t = today();
  let name: string;
  let rows: unknown[][];

  if (kind === "members") {
    const depts = await listDepartments();
    const users = await listUsers();
    name = `구성원_${t}`;
    rows = [
      ["이름", "직무", "재직상태", "권한", "사번", "입사일", "퇴사(예정)일", "조직", "회사 이메일", "휴대전화", "로그인 계정"],
      ...users.map((u) => [
        u.name, u.title, u.status, u.role === "admin" ? "관리자" : "구성원", u.employee_no, u.join_date, u.leave_date,
        departmentPath(u.department_id, depts).join(" > "), u.email, u.phone, u.has_login ? "있음" : "없음",
      ]),
    ];
  } else if (kind === "leaves") {
    const leaves = await listLeaveRequests();
    name = `휴가기록_${t}`;
    rows = [
      ["신청자", "종류", "시작일", "종료일", "단위", "시간(분)", "상태", "결재자", "신청일시", "처리일시", "사유"],
      ...leaves.map((l) => [
        l.user_name, l.type_name, l.start_date, l.end_date, l.unit, l.minutes, LEAVE_STATUS[l.status] ?? l.status,
        l.approver_name, l.created_at, l.decided_at, l.reason,
      ]),
    ];
  } else if (kind === "payroll") {
    const month = new URL(req.url).searchParams.get("month") ?? t.slice(0, 7);
    const run = await get<{ id: number; status: string; pay_date: string }>("SELECT id, status, pay_date FROM payroll_runs WHERE month = ?", month);
    if (!run) return new NextResponse(`${month} 급여 대장이 없어요.`, { status: 404 });
    const slips = await all<{ name: string; employee_no: string | null; detail: string; memo: string | null }>(
      "SELECT u.name, u.employee_no, p.detail, p.memo FROM payslips p JOIN users u ON u.id = p.user_id WHERE p.run_id = ? ORDER BY lower(u.name)", run.id);
    name = `급여대장_${month}${run.status === "confirmed" ? "" : "_미확정"}`;
    rows = [
      ["이름", "사번", "기본급", "식대", "연장수당", "기타수당", "지급계", "국민연금", "건강보험", "장기요양", "고용보험", "소득세", "지방소득세", "기타공제", "공제계", "실지급액", "메모"],
      ...slips.map((s) => {
        const d = JSON.parse(s.detail) as PayDetail;
        return [s.name, s.employee_no, d.base, d.meal, d.overtime, d.extraPay, d.gross, d.pension, d.health, d.ltc, d.employment, d.incomeTax, d.localTax, d.extraDeduction, d.deductions, d.net, s.memo];
      }),
    ];
  } else if (kind === "audit") {
    const logs = await all<{ created_at: string; actor_name: string; action: string; summary: string }>(
      "SELECT created_at, actor_name, action, summary FROM audit_logs ORDER BY id DESC");
    name = `활동기록_${t}`;
    rows = [["시각", "처리자", "작업", "내용"], ...logs.map((l) => [l.created_at, l.actor_name, l.action, l.summary])];
  } else {
    return new NextResponse("알 수 없는 항목입니다.", { status: 404 });
  }

  await audit(me, "settings.export", `데이터 내보내기: ${name}.csv (${rows.length - 1}행)`);
  return new NextResponse(csv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.csv`,
      "cache-control": "no-store",
    },
  });
}
