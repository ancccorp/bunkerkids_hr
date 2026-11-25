import "server-only";
import { all, run } from "./db";
import { nowStamp } from "./dates";

/**
 * 감사 로그. 인사·급여·권한에 영향을 주는 관리 작업을 남긴다.
 * 로그는 수정·삭제 기능을 두지 않는다.
 */
export async function audit(
  actor: { id: number; name: string } | null,
  action: string,
  summary: string,
  target?: { type: string; id?: number | null },
) {
  await run(
    "INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    actor?.id ?? null, actor?.name ?? "시스템", action, target?.type ?? null, target?.id ?? null, summary, nowStamp());
}

export type AuditRow = { id: number; actor_name: string; action: string; target_type: string | null; target_id: number | null; summary: string; created_at: string };

export async function listAudit(opts: { limit?: number; group?: string } = {}) {
  const where = opts.group ? "WHERE action LIKE ?" : "";
  const params = opts.group ? [`${opts.group}.%`, opts.limit ?? 50] : [opts.limit ?? 50];
  return all<AuditRow>(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ?`, ...params);
}

/** 화면 표시용 분류 */
export const AUDIT_GROUPS: Record<string, string> = {
  member: "구성원",
  role: "권한",
  account: "계정",
  leave: "휴가",
  document: "결재",
  payroll: "급여",
  contract: "전자계약",
  certificate: "증명서",
  settings: "설정",
};
