import "server-only";
import { all, get } from "./db";
import { authMode } from "./auth";
import { isDemo } from "./demo";
import { SCHEMA_VERSION } from "./schema";
import { annualBalance, findApprover, listUsers } from "./queries";
import { getSettings } from "./settings";
import { addDays, addMonths, today } from "./dates";

export type Check = { label: string; level: "ok" | "warn" | "error"; detail: string; href?: string };

/** 4대보험 요율 기본값이 기준으로 삼은 연도 (settings-defaults.ts 와 맞춘다) */
const RATES_YEAR = 2026;

/** 관리자 센터의 시스템 점검표. 배포 설정과 운영 데이터의 빈틈을 찾는다. */
export async function systemChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const t = today();
  const year = Number(t.slice(0, 4));
  const day = Number(t.slice(8, 10));
  const month = t.slice(0, 7);

  // 로그인
  const mode = authMode();
  if (isDemo()) checks.push({ label: "로그인 방식", level: "warn", detail: "체험판: 구성원 선택 로그인 (가상 데이터)" });
  else if (mode === "google") checks.push({ label: "로그인 방식", level: "ok", detail: "Google Workspace 로그인" });
  else if (mode === "password") checks.push({ label: "로그인 방식", level: "ok", detail: "이메일·비밀번호 + 관리자 승인" });
  else if (mode === "dev") checks.push({ label: "로그인 방식", level: "warn", detail: "개발 모드 (로컬 전용, 운영 금지)" });
  else checks.push({ label: "로그인 방식", level: "error", detail: "AUTH_SECRET(32자 이상) 환경 변수가 없어 로그인이 막혀 있어요" });

  // 데이터베이스
  const url = process.env.DATABASE_URL ?? "";
  if (isDemo()) checks.push({ label: "데이터베이스", level: "warn", detail: "체험판 메모리 DB (재시작 시 초기화)" });
  else if (!url) checks.push({ label: "데이터베이스", level: "warn", detail: "로컬 내장 DB (PGlite). 운영은 DATABASE_URL 필요" });
  else if (/pooler\.supabase\.com/.test(url) && !/ap-northeast-2/.test(url))
    checks.push({ label: "데이터베이스", level: "warn", detail: "Supabase 연결됨, 단 서울(ap-northeast-2) 리전이 아니라 느릴 수 있어요" });
  else checks.push({ label: "데이터베이스", level: "ok", detail: /supabase/.test(url) ? "Supabase (Postgres) 연결됨" : "Postgres 연결됨" });

  const meta = await get<{ version: number }>("SELECT version FROM schema_meta");
  checks.push({
    label: "DB 스키마",
    level: meta?.version === SCHEMA_VERSION ? "ok" : "error",
    detail: `버전 ${meta?.version ?? "?"} / 앱 ${SCHEMA_VERSION}`,
  });

  // 권한·조직
  const users = await listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] });
  const admins = users.filter((u) => u.role === "admin");
  checks.push(
    admins.length >= 2
      ? { label: "관리자", level: "ok", detail: `${admins.length}명 (${admins.map((u) => u.name).join(", ")})` }
      : { label: "관리자", level: "warn", detail: `${admins.length}명뿐이에요. 부재 시를 대비해 2명 이상을 권장해요`, href: "/admin#roles" },
  );
  const noApprover: string[] = [];
  for (const u of users) if (u.role !== "admin" && !(await findApprover(u.id))) noApprover.push(u.name);
  checks.push(
    noApprover.length === 0
      ? { label: "결재라인", level: "ok", detail: "모든 구성원에게 결재자가 있어요" }
      : { label: "결재라인", level: "warn", detail: `결재자가 없는 구성원 ${noApprover.length}명: ${noApprover.slice(0, 5).join(", ")}`, href: "/settings?tab=org" },
  );
  const unassigned = users.filter((u) => !u.department_id);
  if (unassigned.length)
    checks.push({ label: "조직 미지정", level: "warn", detail: `${unassigned.length}명: ${unassigned.slice(0, 5).map((u) => u.name).join(", ")}`, href: "/people/manage" });

  // 급여·증명서용 인사정보
  const working = users.filter((u) => u.status !== "휴직" && u.join_date <= t);
  const noSalary = working.filter((u) => !u.annual_salary);
  checks.push(
    noSalary.length === 0
      ? { label: "연봉 정보", level: "ok", detail: "재직자 전원 등록" }
      : { label: "연봉 정보", level: "warn", detail: `미등록 ${noSalary.length}명 (급여 대장에서 빠져요): ${noSalary.slice(0, 5).map((u) => u.name).join(", ")}`, href: "/people/manage" },
  );
  const noBirth = working.filter((u) => !u.birth_date);
  if (noBirth.length) checks.push({ label: "생년월일", level: "warn", detail: `미등록 ${noBirth.length}명 (증명서에 '-'로 표시돼요)`, href: "/people/manage" });

  // 연간 갱신 항목
  const s = await getSettings();
  checks.push(
    year > RATES_YEAR
      ? { label: "4대보험 요율", level: "warn", detail: `${RATES_YEAR}년 기준값이에요. ${year}년 고시 요율로 갱신해주세요`, href: "/settings?tab=payroll" }
      : { label: "4대보험 요율", level: "ok", detail: `${RATES_YEAR}년 기준 (국민연금 ${s.rate_pension}%, 건강 ${s.rate_health}%)` },
  );
  const nextYearHolidays = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM holidays WHERE substr(date, 1, 4) = ?", String(year + 1)))!.n;
  checks.push(
    nextYearHolidays > 0 || Number(t.slice(5, 7)) < 10
      ? { label: "공휴일", level: "ok", detail: `${year + 1}년 ${nextYearHolidays}일 등록` }
      : { label: "공휴일", level: "warn", detail: `${year + 1}년 공휴일이 없어요. 연말 전에 등록해주세요`, href: "/settings?tab=holidays" },
  );

  // 이번 달 급여
  const run = await get<{ id: number; status: string }>("SELECT id, status FROM payroll_runs WHERE month = ?", month);
  const payDay = Number(s.pay_day);
  if (run?.status === "confirmed") checks.push({ label: `${Number(month.slice(5))}월 급여`, level: "ok", detail: "확정 완료", href: `/payroll/${run.id}` });
  else if (run) checks.push({ label: `${Number(month.slice(5))}월 급여`, level: day >= payDay - 2 ? "warn" : "ok", detail: `작성 중 (지급일 ${payDay}일)`, href: `/payroll/${run.id}` });
  else checks.push({ label: `${Number(month.slice(5))}월 급여`, level: day >= 20 ? "warn" : "ok", detail: day >= 20 ? `아직 급여 대장이 없어요 (지급일 ${payDay}일)` : "20일경 급여 대장을 만들면 돼요", href: "/payroll" });

  // 연차사용촉진 대상 (6개월 안에 소멸, 잔여 있음)
  const sixMonths = addMonths(t, 6);
  const balances = await Promise.all(working.map(async (u) => ({ u, b: await annualBalance(u, t) })));
  const promote = balances.filter(({ b }) => b.remaining > 0 && b.periodEnd <= sixMonths);
  checks.push({
    label: "연차사용촉진",
    level: promote.length ? "warn" : "ok",
    detail: promote.length
      ? `6개월 안에 연차가 소멸되는 구성원 ${promote.length}명: ${promote.slice(0, 4).map(({ u, b }) => `${u.name}(${b.periodEnd.slice(5)})`).join(", ")}`
      : "6개월 안에 소멸 예정인 연차 없음",
    href: "/time-off/manage?view=balances",
  });

  // 오래 묵은 승인 대기
  const stale = (await all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'pending' AND created_at < ?", `${addDays(t, -3)} 00:00`))[0].n;
  if (stale) checks.push({ label: "휴가 결재 지연", level: "warn", detail: `3일 넘게 대기 중인 휴가 ${stale}건`, href: "/admin#inbox" });

  return checks;
}

