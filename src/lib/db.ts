import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { SCHEMA, SCHEMA_VERSION } from "./schema";
import { seed } from "./seed";

/**
 * Postgres 접근 계층.
 *  - DATABASE_URL 이 있으면 postgres.js 로 접속 (Supabase 는 Transaction pooler, 포트 6543 권장)
 *  - 없으면 내장 PGlite(WASM Postgres)를 data/pglite 에 저장해 로컬에서 별도 설치 없이 실행
 * SQL 은 `?` 자리표시자로 쓰고, 실행 직전에 $1, $2 … 로 바꾼다.
 */

type Row = Record<string, unknown>;
type Exec = (sql: string, params: unknown[]) => Promise<Row[]>;
type Backend = { exec: Exec; begin<T>(fn: (exec: Exec) => Promise<T>): Promise<T> };

declare global {
  // eslint-disable-next-line no-var
  var __hrDb: Promise<Backend> | undefined;
}

async function postgresBackend(url: string): Promise<Backend> {
  const { default: postgres } = await import("postgres");
  const toNumber = { to: 20, from: [20, 1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) };
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const sql = postgres(url, {
    ssl: local || /sslmode=disable/.test(url) ? false : "require", // Supabase 등 원격 DB 는 TLS 필수
    prepare: false, // Supabase pooler(transaction mode)는 prepared statement 를 지원하지 않는다
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    types: { bigint: toNumber },
    onnotice: () => {},
  });
  const run = (q: { unsafe: typeof sql.unsafe }): Exec => async (text, params) =>
    [...(await q.unsafe(text, params as never[]))] as Row[];
  return {
    exec: run(sql),
    begin: (fn) => sql.begin((t) => fn(run(t as unknown as typeof sql))) as Promise<never>,
  };
}

async function pgliteBackend(): Promise<Backend> {
  if (process.env.VERCEL) throw new Error("Vercel 에서는 DATABASE_URL(Supabase 연결 문자열) 환경 변수가 필요합니다.");
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.HR_DB_PATH ?? path.join(process.cwd(), "data", "pglite");
  const pg = await PGlite.create(dir);
  type Q = { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };
  const run = (q: Q): Exec => async (text, params) => (await q.query(text, params)).rows as Row[];
  return { exec: run(pg), begin: (fn) => pg.transaction((t) => fn(run(t))) };
}

async function open(): Promise<Backend> {
  const backend = process.env.DATABASE_URL ? await postgresBackend(process.env.DATABASE_URL) : await pgliteBackend();
  await backend.begin(async (exec) => {
    await exec("SELECT pg_advisory_xact_lock(726354)", []); // 여러 인스턴스가 동시에 초기화하지 않도록
    await exec("CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL)", []);
    const [meta] = await exec("SELECT version FROM schema_meta", []);
    if (meta && meta.version !== SCHEMA_VERSION) {
      throw new Error(`DB 스키마 버전(${meta.version})이 앱(${SCHEMA_VERSION})과 다릅니다. 마이그레이션이 필요합니다.`);
    }
    if (!meta) {
      for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await exec(stmt, []);
      await exec("INSERT INTO schema_meta (version) VALUES ($1)", [SCHEMA_VERSION]);
      await txStore.run(exec, () => seed({ demo: shouldSeedDemo() }));
    }
  });
  return backend;
}

/** 데모 데이터: SEED_DEMO 가 명시되지 않으면 로컬 개발 모드(Google 미설정, Vercel 아님)일 때만 넣는다. */
function shouldSeedDemo() {
  if (process.env.SEED_DEMO) return process.env.SEED_DEMO === "true";
  return !process.env.GOOGLE_CLIENT_ID && !process.env.VERCEL;
}

function backend() {
  globalThis.__hrDb ??= open().catch((e) => {
    globalThis.__hrDb = undefined; // 다음 요청에서 다시 시도
    throw e;
  });
  return globalThis.__hrDb;
}

/** 트랜잭션 안에서는 같은 커넥션으로 실행되도록 현재 실행기를 보관한다. */
const txStore = new AsyncLocalStorage<Exec>();

/** `?` → `$n` (작은따옴표 문자열 안의 ? 는 그대로) */
export function toPg(sql: string) {
  let n = 0;
  let inStr = false;
  let out = "";
  for (const ch of sql) {
    if (ch === "'") inStr = !inStr;
    out += ch === "?" && !inStr ? `$${++n}` : ch;
  }
  return out;
}

type Param = string | number | boolean | null | undefined;

async function exec(sql: string, params: Param[]) {
  const ex = txStore.getStore() ?? (await backend()).exec;
  // undefined·NaN(잘못된 id 등)은 NULL 로 보내 "없음"으로 처리되게 한다 (Postgres 는 NaN 정수를 거부)
  return ex(toPg(sql), params.map((p) => (p === undefined || (typeof p === "number" && Number.isNaN(p)) ? null : p)));
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  return (await exec(sql, params)) as T[];
}

export async function get<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return ((await exec(sql, params))[0] as T | undefined) ?? undefined;
}

const NO_ID = new Set(["settings", "holidays", "notice_reactions", "schema_meta"]);

/** 쓰기 실행. id 컬럼이 있는 테이블의 INSERT 는 새 id 를 돌려준다. */
export async function run(sql: string, ...params: Param[]): Promise<number> {
  const table = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(sql)?.[1];
  const wantsId = table && !NO_ID.has(table) && !/RETURNING/i.test(sql);
  const rows = await exec(wantsId ? `${sql} RETURNING id` : sql, params);
  return wantsId ? Number(rows[0]?.id) : rows.length;
}

export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn(); // 이미 트랜잭션 안
  return (await backend()).begin((ex) => txStore.run(ex, fn));
}
