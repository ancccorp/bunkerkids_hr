import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA, SCHEMA_VERSION } from "./schema";
import { seed } from "./seed";

const DB_PATH = process.env.HR_DB_PATH ?? path.join(process.cwd(), "data", "hr.db");

declare global {
  // eslint-disable-next-line no-var
  var __hrDb: DatabaseSync | undefined;
}

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  const { n: tables } = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number };
  if (tables > 0 && user_version !== SCHEMA_VERSION) {
    throw new Error(
      `DB 스키마 버전(${user_version})이 앱(${SCHEMA_VERSION})과 다릅니다. 개발 DB라면 \`npm run db:reset\` 후 재시작하세요.`,
    );
  }
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM leave_types").get() as { n: number };
  if (n === 0) seed(db, { demo: shouldSeedDemo() });
  return db;
}

/** 데모 데이터: SEED_DEMO 가 명시되지 않으면 개발 모드(Google 미설정)일 때만 넣는다. */
function shouldSeedDemo() {
  if (process.env.SEED_DEMO) return process.env.SEED_DEMO === "true";
  return !process.env.GOOGLE_CLIENT_ID;
}

export function db() {
  // Reuse one connection across hot reloads in dev.
  globalThis.__hrDb ??= open();
  return globalThis.__hrDb;
}

type Params = SQLInputValue[];

/** Rows come back with a null prototype; spread them so they can cross to client components. */
export function all<T>(sql: string, ...params: Params): T[] {
  return db().prepare(sql).all(...params).map((r) => ({ ...r })) as T[];
}

export function get<T>(sql: string, ...params: Params): T | undefined {
  const r = db().prepare(sql).get(...params);
  return r ? ({ ...r } as T) : undefined;
}

export function run(sql: string, ...params: Params) {
  const r = db().prepare(sql).run(...params);
  return Number(r.lastInsertRowid);
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
