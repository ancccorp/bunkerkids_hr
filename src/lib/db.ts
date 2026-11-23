import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
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
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0) seed(db);
  return db;
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
