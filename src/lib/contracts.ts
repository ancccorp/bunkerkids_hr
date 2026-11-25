/**
 * 전자계약 표준 양식. {{변수}} 는 작성 시 구성원·회사 정보로 채워지고, 관리자가 발송 전에 수정할 수 있다.
 * 근로계약서는 근로기준법 제17조 필수 기재사항(임금 구성·계산·지급방법, 소정근로시간, 휴일, 연차유급휴가,
 * 취업 장소와 업무)을 모두 담는다. 서명 후 사본을 근로자에게 교부(열람·출력 가능)해야 한다.
 */

export type ContractVars = {
  company: string;
  ceo: string;
  address: string;
  name: string;
  title: string;
  department: string;
  start_date: string;
  annual_salary: string;
  monthly_salary: string;
  meal_allowance: string;
  work_start: string;
  work_end: string;
  pay_day: string;
  today: string;
};

export const CONTRACT_TEMPLATES: Record<string, { title: string; body: string; salary: boolean }> = {
  근로계약서: {
    title: "근로계약서 (기간의 정함이 없는 경우)",
    salary: true,
    body: `{{company}}(이하 "회사")와 {{name}}(이하 "근로자")은 다음과 같이 근로계약을 체결한다.

제1조 (근로계약기간)
{{start_date}}부터 기간의 정함이 없는 근로계약으로 한다. 입사일부터 3개월은 수습기간으로 하며, 수습기간 중 임금은 정상 임금의 100%를 지급한다.

제2조 (근무장소 및 업무)
근무장소: {{address}} (회사 사무실, 필요 시 재택근무 병행)
업무내용: {{department}} / {{title}}

제3조 (소정근로시간)
1일 8시간, 1주 40시간으로 하며 근무시간은 {{work_start}}부터 {{work_end}}까지로 한다. 휴게시간은 12:00~13:00 (1시간)으로 한다.
업무상 필요한 경우 근로자와 합의하여 1주 12시간 한도에서 연장근로를 할 수 있으며, 연장·야간·휴일근로에는 근로기준법 제56조에 따른 가산수당을 지급한다.

제4조 (휴일)
주휴일은 매주 일요일(유급), 토요일은 무급휴무일로 한다. 근로자의 날 및 관공서의 공휴일에 관한 규정에 따른 공휴일·대체공휴일은 유급휴일로 한다.

제5조 (임금)
1. 연봉: 금 {{annual_salary}}원 (식대 포함)
2. 월 지급액: 금 {{monthly_salary}}원 (기본급 및 월 {{meal_allowance}}원의 식대(비과세)로 구성)
3. 지급일: 매월 {{pay_day}}일 (당월분 지급, 휴일인 경우 전일 지급)
4. 지급방법: 근로자 명의 예금계좌 입금
5. 입사·퇴사 월의 임금은 해당 월의 재직 일수에 따라 일할 계산한다.
6. 소득세 및 4대보험 근로자 부담분은 관계 법령에 따라 원천공제한다.

제6조 (연차유급휴가)
근로기준법 제60조에 따라 부여하며, 세부 기준은 회사 휴가 정책에 따른다.

제7조 (사회보험)
국민연금, 건강보험, 고용보험, 산업재해보상보험에 가입한다.

제8조 (근로계약서 교부)
회사는 계약 체결 즉시 본 계약서 사본을 근로자에게 교부한다 (전자문서 열람·출력 포함).

제9조 (기타)
이 계약에 정함이 없는 사항은 근로기준법 및 회사 취업규칙에 따른다.

{{today}}

회사: {{company}} 대표 {{ceo}}
근로자: {{name}}`,
  },
  연봉계약서: {
    title: "연봉계약서",
    salary: true,
    body: `{{company}}(이하 "회사")와 {{name}}(이하 "근로자")은 다음과 같이 연봉계약을 체결한다.

제1조 (연봉)
1. 연봉: 금 {{annual_salary}}원 (식대 포함)
2. 월 지급액: 금 {{monthly_salary}}원 (월 {{meal_allowance}}원의 식대(비과세) 포함)
3. 지급일: 매월 {{pay_day}}일

제2조 (적용기간)
본 계약은 {{today}}부터 다음 연봉계약 체결 시까지 적용한다.

제3조 (기타)
그 밖의 근로조건은 기존 근로계약서 및 취업규칙에 따른다.

{{today}}

회사: {{company}} 대표 {{ceo}}
근로자: {{name}}`,
  },
  비밀유지서약서: {
    title: "비밀유지 및 정보보호 서약서",
    salary: false,
    body: `본인 {{name}}은(는) {{company}}에 재직하는 동안 및 퇴직 후에도 다음 사항을 준수할 것을 서약합니다.

1. 업무상 알게 된 회사의 영업비밀, 기술정보, 고객 및 임직원의 개인정보를 회사의 사전 승인 없이 외부에 공개하거나 업무 외 목적으로 사용하지 않습니다.
2. 개인정보는 업무 목적 범위에서만 처리하며 개인정보 보호법 등 관계 법령과 회사 보안 정책을 준수합니다.
3. 퇴직 시 회사 자료와 장비를 모두 반납하고, 사본을 보관하지 않습니다.
4. 위 사항을 위반하여 회사에 손해를 끼친 경우 관계 법령에 따른 책임을 집니다.

{{today}}

서약자: {{name}} ({{department}} / {{title}})
{{company}} 대표 {{ceo}} 귀하`,
  },
};

export function fillTemplate(body: string, vars: ContractVars) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? `{{${k}}}`);
}

export const CONTRACT_STATUS: Record<string, string> = { sent: "서명대기", signed: "서명완료", void: "폐기" };
