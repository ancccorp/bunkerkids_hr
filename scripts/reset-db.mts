// 로컬 내장 DB(PGlite)를 지웁니다. 다음 요청 때 데모 데이터로 다시 만들어집니다.
// Supabase 등 DATABASE_URL 로 연결한 DB는 건드리지 않습니다.
import fs from "node:fs";
import path from "node:path";

if (process.env.DATABASE_URL) {
  console.error("DATABASE_URL 이 설정되어 있어 중단합니다. 원격 DB는 Supabase 화면에서 관리하세요.");
  process.exit(1);
}
const dir = process.env.HR_DB_PATH ?? path.join(process.cwd(), "data", "pglite");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${dir} 를 지웠습니다. 개발 서버를 다시 시작하면 데모 데이터로 새로 만들어집니다.`);
