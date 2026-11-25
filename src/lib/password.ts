/**
 * 비밀번호 해시 (scrypt, Node 내장). 원문은 어디에도 저장하지 않는다.
 * 형식: scrypt$N$r$p$salt(base64url)$hash(base64url)
 */
import crypto from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** 최소 기준: 8자 이상, 영문과 숫자 포함 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "비밀번호는 8자 이상이어야 해요.";
  if (password.length > 128) return "비밀번호가 너무 길어요.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "비밀번호에 영문과 숫자를 모두 넣어주세요.";
  return null;
}
