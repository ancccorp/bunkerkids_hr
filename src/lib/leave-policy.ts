/**
 * 연차 산정 (근로기준법 제60조). 순수 함수만 둔다 — DB 접근 없음.
 *
 * 입사일 기준(hire)
 *  - 1년 미만: 1개월 개근 시 1일, 최대 11일. 입사 1주년에 소멸 (제60조 제2항, 제61조 제2항).
 *  - 1년 이상: 15일. 최초 1년을 초과하는 계속근로 2년마다 1일 가산, 최대 25일 (제60조 제1항·제4항).
 *  - 산정 기간은 매 입사기념일부터 1년.
 *
 * 회계연도 기준(fiscal, 1/1~12/31)
 *  - 입사연도·다음 연도: 1년 미만 월 단위 연차를 발생할 때마다 부여.
 *    입사연도에 생긴 월차 중 남은 것은 입사 1주년 전까지 다음 연도로 이월.
 *  - 입사 다음 해 1/1: 15일 × (입사연도 재직일수 / 그해 일수), 0.5일 단위 올림.
 *  - 그 이후 1/1: 입사연도를 제외한 근속 연수 n에 대해 15 + ⌊(n-1)/2⌋일, 최대 25일.
 *  - 퇴사 시 입사일 기준보다 적게 받았다면 차이를 정산해야 한다.
 */
import { addMonths, addYears, DAY_MINUTES, daysBetween } from "./dates";

export type LeaveBasis = "hire" | "fiscal";

export type Entitlement = {
  periodStart: string; // 포함
  periodEnd: string; // 미포함 (이 날 소멸)
  minutes: number;
  lines: { label: string; minutes: number }[];
};

/** 해당 기간에 이미 사용(승인+대기)한 연차 분 — 이월 계산에 필요 */
export type UsedFn = (from: string, to: string) => number;

function seniorityDays(fullYears: number) {
  return Math.min(25, 15 + Math.floor((fullYears - 1) / 2));
}

/** 입사 후 1년 미만 기간에 [from, to] 사이에 발생한 월 단위 연차 수 */
function monthlyAccruals(joinDate: string, from: string, to: string) {
  let n = 0;
  for (let k = 1; k <= 11; k++) {
    const d = addMonths(joinDate, k);
    if (d >= from && d <= to) n++;
  }
  return n;
}

export function annualEntitlement(joinDate: string, asOf: string, basis: LeaveBasis, usedIn: UsedFn = () => 0): Entitlement {
  if (joinDate > asOf) return { periodStart: joinDate, periodEnd: addYears(joinDate, 1), minutes: 0, lines: [] };
  return basis === "fiscal" ? fiscal(joinDate, asOf, usedIn) : hire(joinDate, asOf);
}

function hire(joinDate: string, asOf: string): Entitlement {
  let years = 0;
  while (addYears(joinDate, years + 1) <= asOf) years++;
  const periodStart = addYears(joinDate, years);
  const periodEnd = addYears(joinDate, years + 1);
  if (years === 0) {
    const m = monthlyAccruals(joinDate, joinDate, asOf);
    return { periodStart, periodEnd, minutes: m * DAY_MINUTES, lines: [{ label: `1년 미만 월 단위 연차 (${m}개월 개근)`, minutes: m * DAY_MINUTES }] };
  }
  const days = seniorityDays(years);
  const lines = [{ label: `근속 ${years}년차 기본 연차`, minutes: 15 * DAY_MINUTES }];
  if (days > 15) lines.push({ label: "근속 가산 연차", minutes: (days - 15) * DAY_MINUTES });
  return { periodStart, periodEnd, minutes: days * DAY_MINUTES, lines };
}

function fiscal(joinDate: string, asOf: string, usedIn: UsedFn): Entitlement {
  const year = Number(asOf.slice(0, 4));
  const joinYear = Number(joinDate.slice(0, 4));
  const periodStart = `${year}-01-01`;
  const periodEnd = `${year + 1}-01-01`;
  const anniversary = addYears(joinDate, 1);
  const lines: Entitlement["lines"] = [];

  // 1년 미만 월 단위 연차 (올해 발생분)
  const m = monthlyAccruals(joinDate, periodStart, asOf < anniversary ? asOf : addMonths(anniversary, -1));
  if (m > 0) lines.push({ label: `1년 미만 월 단위 연차 (${m}개월 개근)`, minutes: m * DAY_MINUTES });

  if (year === joinYear + 1) {
    // 입사연도 월차 중 미사용분 이월 (1주년 전까지만 유효)
    if (asOf < anniversary) {
      const prevStart = `${joinYear}-01-01`;
      const prevAccrued = monthlyAccruals(joinDate, joinDate, `${joinYear}-12-31`) * DAY_MINUTES;
      const carry = Math.max(0, prevAccrued - usedIn(prevStart, periodStart));
      if (carry > 0) lines.push({ label: `입사연도 월 단위 연차 이월 (${anniversary} 소멸)`, minutes: carry });
    }
    // 입사연도 재직 비율만큼 비례 연차
    const worked = daysBetween(joinDate, periodStart);
    const yearDays = daysBetween(`${joinYear}-01-01`, periodStart);
    const halfDays = Math.ceil(((15 * worked) / yearDays) * 2) / 2;
    lines.push({ label: `입사연도 재직 비례 연차 (${worked}/${yearDays}일)`, minutes: Math.round(halfDays * DAY_MINUTES) });
  } else if (year >= joinYear + 2) {
    const n = year - joinYear - 1;
    const days = seniorityDays(n);
    lines.push({ label: `회계연도 기준 ${n + 1}년차 기본 연차`, minutes: 15 * DAY_MINUTES });
    if (days > 15) lines.push({ label: "근속 가산 연차", minutes: (days - 15) * DAY_MINUTES });
  }

  return { periodStart, periodEnd, minutes: lines.reduce((a, l) => a + l.minutes, 0), lines };
}
