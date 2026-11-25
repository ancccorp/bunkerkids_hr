// Demo data. Every person, phone number and email here is fictional.
import { addDays, DAY_MINUTES, isWeekend, startOfWeek, today } from "./dates";
import { DEFAULT_HOLIDAYS } from "./holidays";
import { CONTRACT_TEMPLATES, fillTemplate } from "./contracts";
import { DEFAULT_SETTINGS as S } from "./settings-defaults";
import crypto from "node:crypto";
import { run } from "./db";

const COLORS = ["#f97066", "#9e77ed", "#36bffa", "#fdb022", "#32d583", "#ee46bc", "#6172f3", "#fd853a"];

const SALARY: Record<string, number> = { CEO: 120_000_000, COO: 96_000_000, CPO: 96_000_000, Engineer: 60_000_000, PM: 55_000_000 };

/** 기본 데이터(휴가 유형, 공휴일)는 항상, 데모 구성원·문서는 opts.demo 일 때만 넣는다. */
/** 반드시 트랜잭션 안에서 호출한다 (db.ts 의 초기화 과정). */
export async function seed(opts: { demo: boolean } = { demo: true }) {
  const t = today();
  const ins = (sql: string, ...p: (string | number | null)[]) => run(sql, ...p);
  {
    // ── 휴가 유형 ────────────────────────────────────────
    const lt = async (name: string, icon: string, desc: string, grant: number | null, annual = 0) =>
      await ins("INSERT INTO leave_types (name, icon, is_annual, grant_minutes, description) VALUES (?, ?, ?, ?, ?)", name, icon, annual, grant, desc);
    const annual = await lt("연차", "🏖️", "근로기준법 제60조 (유급)", null, 1);
    await lt("배우자 출산", "👶", "출산일부터 120일 내 20일 (유급, 분할 3회)", 20 * DAY_MINUTES);
    await lt("배우자 유산·사산", "🕊️", "신청 시 3일 (첫날 유급)", 3 * DAY_MINUTES);
    await lt("출산전후휴가", "🤱", "90일, 다태아 120일 (최초 60일 유급)", 90 * DAY_MINUTES);
    await lt("가족돌봄휴가", "🏠", "연 10일 (무급)", 10 * DAY_MINUTES);
    await lt("보건휴가", "🌸", "월 1일 (무급, 여성 근로자 청구 시)", DAY_MINUTES);
    await lt("결혼 - 본인", "💍", "경조휴가 5일 (유급, 회사 규정)", 5 * DAY_MINUTES);
    await lt("조의 - 부모/배우자/자녀", "🤍", "경조휴가 5일 (유급, 회사 규정)", 5 * DAY_MINUTES);
    await lt("조의 - 조부모/형제/자매", "🤍", "경조휴가 3일 (유급, 회사 규정)", 3 * DAY_MINUTES);
    await lt("병가", "🩺", "연차 소진 후 연 60일 (무급, 진단서 필요)", 60 * DAY_MINUTES);
    await lt("예비군·민방위 훈련", "🎖️", "훈련 기간 공가 (유급)", null);
    await lt("건강검진", "🏥", "연 1회 4시간 공가 (유급)", 4 * 60);

    for (const [date, name] of DEFAULT_HOLIDAYS) await ins("INSERT INTO holidays (date, name) VALUES (?, ?)", date, name);

    if (!opts.demo) {
      await ins("INSERT INTO departments (name, parent_id) VALUES (?, NULL)", "벙커키즈");
      return;
    }

    // ── 조직 ──────────────────────────────────────────────
    const dept = async (name: string, parent: number | null) =>
      await ins("INSERT INTO departments (name, parent_id) VALUES (?, ?)", name, parent);
    const root = await dept("벙커키즈", null);
    const business = await dept("Business", root);
    const product = await dept("Product", root);
    const mgmt = await dept("MGMT", root);
    const operation = await dept("Operation", business);
    const marketing = await dept("Marketing", business);
    const tech = await dept("Tech", product);
    const pm = await dept("PM", product);

    // ── 구성원 ────────────────────────────────────────────
    type P = [name: string, title: string, dept: number, join: string, status?: string, role?: string];
    const people: P[] = [
      ["Jay", "CEO", root, "2023-03-02", "재직", "admin"],
      ["Ed", "COO", business, "2024-03-05"],
      ["Sora", "CPO", product, "2024-06-03"],
      ["Bob", "HR Manager", mgmt, addDays(t, -54), "재직", "admin"],
      ["Amy", "CS Manager", operation, "2026-03-01"],
      ["Annie", "Operation Manager", operation, addDays(t, -35), "수습"],
      ["Chloe", "Marketer", marketing, "2026-03-01"],
      ["Crystal", "Marketer", marketing, "2025-09-01"],
      ["Derrick", "Marketer", marketing, "2026-04-27"],
      ["Betty", "Engineer", tech, "2025-07-16"],
      ["Cohen", "Engineer", tech, addDays(t, -63), "수습"],
      ["Dawny", "Engineer", tech, "2026-07-27"],
      ["Logan", "Engineer", tech, "2025-05-20", "휴직"],
      ["Brian", "PM", pm, "2026-03-01"],
      ["Hana", "Designer", pm, "2025-11-10", "퇴사예정"],
      ["Mina", "Operation", operation, addDays(t, 7), "재직"], // 입사 예정
    ];
    const ids: Record<string, number> = {};
    for (const [i, [name, title, d, join, status = "재직", role = "member"]] of people.entries()) {
      ids[name] = await ins(
        `INSERT INTO users (name, title, email, phone, employee_no, join_date, leave_date, status, department_id, role, color, annual_salary, birth_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        name,
        title,
        `${name.toLowerCase()}@bunkerkids.example`,
        `010-0000-${String(1001 + i)}`,
        `BK${join.replace(/-/g, "").slice(0, 6)}${String(i + 1).padStart(2, "0")}`,
        join,
        status === "퇴사예정" ? addDays(t, 30) : null,
        status,
        d,
        role,
        COLORS[i % COLORS.length],
        SALARY[title] ?? 42_000_000,
        `${1985 + (i % 12)}-0${1 + (i % 9)}-15`,
      );
    }

    // 결재권자: 상위 조직장이 기본 결재자
    const setApprover = async (d: number, u: number) => run("UPDATE departments SET approver_id = ? WHERE id = ?", u, d);
    await setApprover(root, ids.Jay);
    for (const d of [business, operation, marketing]) await setApprover(d, ids.Ed);
    for (const d of [product, tech, pm]) await setApprover(d, ids.Sora);
    await setApprover(mgmt, ids.Jay);

    // ── 휴가 신청 ────────────────────────────────────────
    const week = startOfWeek(t);
    const leave = async (who: string, start: string, end: string, unit: string, minutes: number, status: string,
                   approver: string, st: string | null = null, et: string | null = null, reason = "개인 사유") =>
      await ins(`INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, unit, start_time, end_time, minutes, reason, status, approver_id, created_at, decided_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ids[who], annual, start, end, unit, st, et, minutes, reason, status, ids[approver],
        `${addDays(start, -7)} 10:00`, status === "pending" ? null : `${addDays(start, -6)} 11:00`);

    await leave("Sora", addDays(week, 4), addDays(week, 4), "day", DAY_MINUTES, "approved", "Jay");
    await leave("Betty", addDays(week, 4), addDays(week, 4), "day", DAY_MINUTES, "approved", "Sora");
    await leave("Chloe", week, week, "hours", 180, "approved", "Ed", "10:30", "13:30");
    await leave("Chloe", addDays(week, 2), addDays(week, 2), "hours", 180, "approved", "Ed", "10:30", "13:30");
    await leave("Bob", addDays(t, -12), addDays(t, -12), "hours", 120, "approved", "Jay", "17:00", "19:00");
    await leave("Bob", addDays(t, -14), addDays(t, -14), "day", DAY_MINUTES, "cancelled", "Jay");
    await leave("Bob", addDays(t, -20), addDays(t, -20), "hours", 120, "pending", "Jay", "10:00", "12:00");
    await leave("Amy", addDays(week, 9), addDays(week, 10), "day", 2 * DAY_MINUTES, "pending", "Ed", null, null, "가족 여행");
    await leave("Brian", addDays(week, 8), addDays(week, 8), "am", 4 * 60, "pending", "Sora", "10:00", "14:00");

    // ── 근무 기록 (기본 근무와 다른 날만 저장) ───────────
    for (let i = 0; i < 5; i++) {
      const d = addDays(week, i);
      if (!isWeekend(d)) {
        await ins("INSERT INTO work_records (user_id, date, start_time, end_time) VALUES (?, ?, ?, ?)", ids.Brian, d, "09:00", "18:00");
      }
    }

    // ── 공지 ──────────────────────────────────────────────
    const notice = async (title: string, emoji: string, category: string, body: string, author: string, ago: number) =>
      await ins("INSERT INTO notices (title, emoji, category, body, author_id, published_at) VALUES (?, ?, ?, ?, ?, ?)",
        title, emoji, category, body, ids[author], `${addDays(t, -ago)} 21:26`);
    const n1 = await notice("휴가 결재라인 생성", "🌴", "사내규정",
      `휴가 결재 라인이 생성되었습니다.

앞으로 원활한 업무일정 조율과 팀 내 일정 파악을 위해 도입하게 되었습니다.
따라서, 앞으로는 부서별 승인 후 휴가를 사용할 수 있도록 참고 부탁드립니다.

✅ 결재라인
- Product → Sora
- Business → Ed

🌴 휴가사용시
- 휴가 사용 전에는 업무에 지장이 가지 않도록 팀과 조직장, 유관 협업자와 업무 일정을 조율해주세요.
- 휴가 사용 시에는 조직장의 승인이 필요하오니 조직장에게 사전 공유 부탁 드립니다.
- 가급적 휴가 사용 전까지 승인이 완료될 수 있도록 신경써 주시면 감사하겠습니다.`, "Bob", 60);
    await notice("워크플로우 문서 작성 안내", "📝", "사내규정",
      `안녕하세요! 벙키 여러분

최근 비품 구매, 비용 송금, 계약서 발송 등 경영지원팀(MGMT)으로 전달되는 요청사항이 다양해짐에 따라, 앞으로는 워크플로우를 통해 요청사항을 접수하고자 합니다.

- 지출결의서(이체요청서): 비용 송금이 필요할 때
- 비품 구매 요청: 업무용 장비·소모품
- 지원금 신청: 교육/도서/AI 도구 지원금`, "Bob", 95);
    await notice("사내추천제도(Employee Referral)", "👫", "사내규정",
      `안녕하세요! 여러분

지금 우리는 벙커키즈의 폭발적인 성장을 함께 이끌어갈 훌륭한 동료들을 찾고 있습니다.
추천하신 분이 최종 합류해 수습기간을 통과하면 추천 보상금을 지급합니다.`, "Jay", 100);
    await notice("법인카드 사용 공지", "💳", "사내규정",
      `카드 사용법

이용내역 및 잔여한도는 카드사 사이트를 통해 확인하실 수 있습니다.
사용 후 영수증은 7일 이내에 워크플로우 > 지출결의서로 제출해 주세요.`, "Bob", 101);
    for (const who of ["Amy", "Brian", "Chloe"]) {
      await run("INSERT INTO notice_reactions (notice_id, user_id, emoji) VALUES (?, ?, '👍')", n1, ids[who]);
    }

    // ── 워크플로우 문서 (Bob이 결재해야 할 문서) ─────────
    const doc = async (template: string, title: string, body: string, amount: number | null, author: string, ago: number, approvers: string[]) => {
      const id = await ins("INSERT INTO documents (template, title, body, amount, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        template, title, body, amount, ids[author], `${addDays(t, -ago)} 14:00`);
      for (const [i, a] of approvers.entries())
        await ins("INSERT INTO approval_steps (document_id, step, approver_id, status) VALUES (?, ?, ?, ?)",
          id, i + 1, ids[a], i === 0 ? "pending" : "waiting");
    };
    await doc("지원금 신청", "AI 도구 구독 지원금 신청", "업무용 AI 도구 연간 구독료 지원을 요청합니다.", 290000, "Betty", 6, ["Bob", "Jay"]);
    await doc("지출결의서(이체요청서)", "촬영 장비 렌탈 비용", "11월 콘텐츠 촬영 장비 렌탈 비용 이체 요청드립니다.", 450000, "Crystal", 6, ["Bob"]);
    await doc("지출결의서(이체요청서)", "오프라인 행사 부스 대관료", "12월 오프라인 행사 부스 대관료 선금입니다.", 1200000, "Amy", 7, ["Bob", "Jay"]);

    // ── 인정 ──────────────────────────────────────────────
    await ins("INSERT INTO kudos (from_id, to_id, emoji, message, created_at) VALUES (?, ?, ?, ?, ?)",
      ids.Sora, ids.Betty, "🚀", "배포 자동화 덕분에 릴리즈가 훨씬 편해졌어요!", `${addDays(t, -3)} 15:00`);

    // ── 전자계약 (서명 대기) ─────────────────────────────
    const annieJoin = people.find((p) => p[0] === "Annie")![3];
    const body = fillTemplate(CONTRACT_TEMPLATES["근로계약서"].body, {
      company: S.company_name, ceo: S.company_ceo, address: S.company_address, name: "Annie", title: "Operation Manager",
      department: "벙커키즈 › Business › Operation", start_date: annieJoin, annual_salary: "42,000,000", monthly_salary: "3,500,000",
      meal_allowance: "200,000", work_start: S.work_start, work_end: S.work_end, pay_day: S.pay_day, today: t,
    });
    await ins(`INSERT INTO contracts (user_id, template, title, body, annual_salary, status, created_by, created_at, body_hash)
         VALUES (?, '근로계약서', ?, ?, 42000000, 'sent', ?, ?, ?)`,
      ids.Annie, "근로계약서 (기간의 정함이 없는 경우) - Annie", body, ids.Bob, `${addDays(t, -2)} 10:00`,
      crypto.createHash("sha256").update(body).digest("hex"));

  }
}
