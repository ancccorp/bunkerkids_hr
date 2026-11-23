import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import type { User } from "./queries";

/**
 * 인증
 *  - google: Google Workspace OAuth. ALLOWED_EMAIL_DOMAIN 계정 중 구성원으로 등록된 이메일만 로그인.
 *  - dev   : 로그인 화면에서 구성원을 골라 들어간다. GOOGLE_CLIENT_ID 가 없으면 자동으로 dev.
 * 세션은 HMAC-SHA256 으로 서명한 쿠키(userId.만료시각.서명)이며 12시간 유효.
 */

export const SESSION_COOKIE = "hr_session";
const SESSION_HOURS = 12;

export function authMode(): "google" | "dev" {
  if (process.env.AUTH_MODE === "dev") return "dev";
  return process.env.GOOGLE_CLIENT_ID ? "google" : "dev";
}

let devSecret: string | undefined;
function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (authMode() === "google") throw new Error("AUTH_SECRET (32자 이상) 환경 변수가 필요합니다.");
  devSecret ??= crypto.randomBytes(32).toString("hex"); // dev: 서버 재시작 시 로그아웃
  return devSecret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionValue(userId: number) {
  const payload = `${userId}.${Date.now() + SESSION_HOURS * 3600_000}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = sign(`${id}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(id) || null;
}

export async function setSession(userId: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(userId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && authMode() === "google",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

const USER_SQL = "SELECT u.*, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ? AND u.status != '퇴사'";

/** 로그인하지 않았으면 null */
export async function sessionUser(): Promise<User | null> {
  const id = verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  return id ? get<User>(USER_SQL, id) ?? null : null;
}

/** 로그인 필수. 없으면 /login 으로 보낸다. */
export async function currentUser(): Promise<User> {
  const user = await sessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export function allowedDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? "").toLowerCase();
}

export function oauthRedirectUri(origin: string) {
  return `${process.env.APP_URL ?? origin}/api/auth/callback`;
}
