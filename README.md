# 벙커키즈 HR

벙커키즈 사내 인사관리시스템(HRIS). flex.team의 기능 구성을 참고했고, 근로기준법 등 국내 표준 기준으로 정책을 구현했습니다.
운영 정책과 사용 가이드는 `docs/벙커키즈_HR_표준정책_가이드.pdf`에 정리되어 있습니다.

## 기능

| 메뉴 | 내용 |
| --- | --- |
| 로그인 | 이메일·비밀번호 가입 → 관리자 승인 (베타 기본), 또는 Google Workspace. 회사 도메인 제한, 5회 실패 시 15분 잠금, 12시간 서명 세션 |
| 홈 피드 | 내가 결재할 할 일, 최근 공지, 동료 인정, 이번 주 캘린더·공휴일 |
| 공지 | 목록/상세, 카테고리, 리액션, 댓글, 숨김 (작성은 관리자) |
| 구성원 / 구성원 관리 | 디렉터리, 프로필, 재직상태 필터 표, 근속기간, CSV 다운로드, 연봉·부양가족 등 급여 정보 |
| 근무 | 주간 근무표 (기본 근무시간 설정, 근무 기록 수정, 휴가·공휴일 반영, 휴게시간 자동 공제) |
| 휴가 | 연차 산정 내역(입사일/회계연도 기준), 법정·회사 휴가 13종, 종일/반차/시간 단위 신청 |
| 휴가 관리 | 승인/반려 (관리자·결재권자), 구성원별 연차 현황, 수동 조정 이력 |
| 워크플로우 | 지출결의서 등 문서 작성, 최대 3단계 결재선 |
| 전자계약 | 근로계약서·연봉계약서·비밀유지서약서 양식, 본인 서명(동의+이름), SHA-256 문서 해시 |
| 급여 | 월 급여 대장(일할·연장수당·4대보험·간이세액 추정), 확정 후 임금명세서 공개 |
| 증명서 | 재직·경력증명서 셀프 발급, 문서번호·발급 대장, 인쇄/PDF |
| 설정 | 회사 정보, 근무시간, 연차 기준, 급여일·보험요율, 조직·결재라인, 공휴일 |

## 실행

Node.js 22.13 이상이 필요합니다. DB는 Postgres(운영: Supabase)이며, `DATABASE_URL`이 없으면 내장 Postgres(PGlite)를 `data/pglite`에 만들어 쓰므로 로컬에서는 별도 설치가 필요 없습니다.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 연차·급여 계산 단위 테스트
```

`.env.local`이 없으면 **개발 모드**입니다: 로그인 화면에서 구성원을 골라 들어가고, 가상의 데모 데이터가 들어갑니다.
로컬 DB를 초기화하려면 `npm run db:reset` 후 서버를 재시작하세요.

## 운영 배포 (Supabase + Vercel)

1. **Supabase**: 새 프로젝트를 Northeast Asia (Seoul) 리전에 만들고, Connect › Direct › **Transaction pooler**(포트 6543) 연결 문자열을 확인합니다.
2. **Vercel**: GitHub 저장소를 Import하고 Environment Variables에 `DATABASE_URL`, `AUTH_SECRET`, `ALLOWED_EMAIL_DOMAIN`, `BOOTSTRAP_ADMIN_EMAIL`을 넣습니다. 리전은 `vercel.json`에서 서울(icn1)로 지정되어 있습니다.
3. 첫 요청 때 테이블이 자동 생성되고(이후 버전은 자동 마이그레이션), 배포 환경에서는 데모 데이터 없이 휴가 유형·공휴일만 들어갑니다.
4. 사이트에서 `BOOTSTRAP_ADMIN_EMAIL`로 **회원가입**하면 승인 없이 첫 관리자가 됩니다. 이후 직원은 회원가입 → 관리자가 구성원 관리 › 가입 요청에서 승인합니다.
5. (선택) Google 로그인으로 바꾸려면 Google Cloud Console에서 OAuth 클라이언트(웹 애플리케이션, 리디렉션 URI `{APP_URL}/api/auth/callback`)를 만들고 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`을 추가합니다. 구성원의 회사 이메일이 Google 계정과 같아야 합니다.
6. 백업은 Supabase가 매일 자동으로 합니다 (Pro 요금제에서 7일 보관).

## 구조

```
src/lib/leave-policy.ts   연차 산정 (순수 함수, 테스트 대상)
src/lib/payroll.ts        급여·4대보험·간이세액 계산 (순수 함수, 테스트 대상)
src/lib/holidays.ts       2025–2027 공휴일 기본값
src/lib/contracts.ts      계약서 양식
src/lib/db.ts             Postgres 접근 (postgres.js / 로컬 PGlite), 스키마 자동 생성
src/lib/settings*.ts      회사 설정 기본값과 조회
src/lib/queries.ts        조회 + 근무표·잔여 연차
src/lib/hr.ts             급여 대장 생성, 증명서 스냅샷
src/lib/auth.ts           세션·Google OAuth 보조
src/app/actions.ts        서버 액션 (모든 쓰기)
src/app/(app)/**          로그인 후 화면
tests/                    단위 테스트
```

## 알려진 한계

- 소득세는 간이세액표 산식을 단순화한 **추정치**입니다. 지급 전 국세청 간이세액표와 대조하세요.
- 전자계약은 본인 확인(회사 Google 계정) + 동의 + 이름 입력 + 문서 해시 방식입니다. 공인 전자서명이 필요한 계약에는 별도 서비스를 쓰세요.
- 4대보험 요율·국민연금 상하한·공휴일은 매년 설정에서 갱신해야 합니다.
- 스키마 버전은 `schema_meta` 테이블로 관리합니다. 운영 데이터가 생긴 뒤 스키마를 바꾸면 마이그레이션 코드를 추가해야 합니다.
