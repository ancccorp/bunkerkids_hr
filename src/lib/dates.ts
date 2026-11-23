// Date helpers. All dates are local 'YYYY-MM-DD' strings to avoid timezone drift.

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
export const DAY_MINUTES = 8 * 60; // 1일 소정근로시간
export const WORK_START = "10:00";
export const WORK_END = "19:00";

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISO(new Date());
}

export function nowStamp() {
  const d = new Date();
  return `${toISO(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function startOfWeek(s: string) {
  // 월요일 시작
  const d = parseISO(s);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}

export function weekday(s: string) {
  return parseISO(s).getDay();
}

export function isWeekend(s: string) {
  const w = weekday(s);
  return w === 0 || w === 6;
}

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "2026. 11. 11 (수)" */
export function fmtDate(s: string, withDay = true) {
  const d = parseISO(s);
  const base = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
  return withDay ? `${base} (${WEEKDAYS[d.getDay()]})` : base;
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(m: number) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "오전 10:00" / "오후 7:00" */
export function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${pad(m)}`;
}

/** 근무시간 계산: 4시간 이상이면 30분, 8시간 이상이면 1시간 휴게 공제 (근로기준법 제54조) */
export function workedMinutes(start: string, end: string) {
  const span = toMinutes(end) - toMinutes(start);
  if (span >= 9 * 60) return span - 60;
  if (span >= 4.5 * 60) return span - 30;
  return Math.max(0, span);
}

/** 분 → "1일 2시간 30분" (1일 = 8시간) */
export function fmtDuration(minutes: number, useDays = true) {
  const neg = minutes < 0;
  let m = Math.abs(minutes);
  const parts: string[] = [];
  if (useDays && m >= DAY_MINUTES) {
    parts.push(`${Math.floor(m / DAY_MINUTES)}일`);
    m %= DAY_MINUTES;
  }
  if (m >= 60) {
    parts.push(`${Math.floor(m / 60)}시간`);
    m %= 60;
  }
  if (m > 0) parts.push(`${m}분`);
  if (parts.length === 0) return "0시간";
  return (neg ? "-" : "") + parts.join(" ");
}

/** 분 → "40:00" */
export function fmtHM(minutes: number) {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

/** 근속기간 "1년 6개월" */
export function tenure(joinDate: string, asOf = today()) {
  if (joinDate > asOf) return "";
  const a = parseISO(joinDate);
  const b = parseISO(asOf);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  if (months <= 0) {
    const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    return `${days}일`;
  }
  const y = Math.floor(months / 12);
  const mo = months % 12;
  return [y ? `${y}년` : "", mo ? `${mo}개월` : ""].filter(Boolean).join(" ");
}

/** "6일 전", "2달 전" */
export function relative(stamp: string, asOf = today()) {
  const days = Math.round((parseISO(asOf).getTime() - parseISO(stamp.slice(0, 10)).getTime()) / 86400000);
  if (days <= 0) return "오늘";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}달 전`;
  return `${Math.floor(days / 365)}년 전`;
}

/** 근로기준법 제60조 기준 연차 발생일수 (회계연도가 아닌 입사일 기준 단순 계산) */
export function annualLeaveDays(joinDate: string, year: number) {
  const join = parseISO(joinDate);
  const yearsAtStart = year - join.getFullYear();
  if (yearsAtStart <= 0) {
    // 입사 첫해: 1개월 개근 시 1일 (최대 11일)
    const months = 12 - join.getMonth() - 1;
    return Math.max(0, Math.min(11, months));
  }
  if (yearsAtStart < 3) return 15;
  return Math.min(25, 15 + Math.floor((yearsAtStart - 1) / 2));
}
