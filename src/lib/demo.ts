/**
 * 체험(데모) 모드: Vercel 미리보기 배포이거나 DEMO_MODE=true 일 때.
 *  - 구성원을 골라 로그인 (비밀번호 없음)
 *  - 실제 DB(DATABASE_URL)를 쓰지 않고 메모리 안의 Postgres(PGlite)에 가상 데이터를 넣어 쓴다
 *  - 데이터는 서버가 재시작되면 초기화된다
 * 미리보기 주소는 Vercel 배포 보호(로그인한 팀원만 접근)로 외부에 공개되지 않는다.
 * 미리보기에서도 실제 DB를 쓰려면 DEMO_MODE=false 를 넣는다.
 */
export function isDemo() {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return process.env.VERCEL_ENV === "preview";
}
