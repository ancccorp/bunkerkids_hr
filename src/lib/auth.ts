import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import { USER_COLUMNS, type User } from "./queries";
import { isDemo } from "./demo";

/**
 * 인증
 *  - google: Google Workspace OAuth. ALLOWED_EMAIL_DOMAIN 계정 중 구성원으로 등록된 이메일만 로그인.
 *  - password: 이메일·비밀번호. 회원가입 후 관리자가 승인해야 로그인된다.
 *              배포 환경(Vercel)에서 Google 설정이 없으면 기본값. 로컬은 AUTH_MODE=password 로 켤 수 있다.
 *  - dev   : 로그인 화면에서 구성원을 골라 들어간다. 로컬에서만.
 *  - unconfigured: 배포 환경인데 AUTH_SECRET 이 없을 때. 아무도 로그인할 수 없다
 *    (배포본이 개발 모드로 열려 누구나 관리자로 들어오는 사고를 막는다).
 * 세션은 HMAC-SHA256 으로 서명한 쿠키(userId.만료시각.서명)이며 12시간 유효.
 */

export const SESSION_COOKIE = "hr_session";
const SESSION_HOURS = 12;

export type AuthMode = "google" | "password" | "dev" | "unconfigured";

export function authMode(): AuthMode {
  if (isDemo()) return "dev"; // 체험 모드: 구성원 선택 로그인
  const hasSecret = (process.env.AUTH_SECRET ?? "").length >= 32;
  if (process.env.GOOGLE_CLIENT_ID) return hasSecret ? "google" : "unconfigured";
  if (process.env.VERCEL || process.env.AUTH_MODE === "password") return hasSecret ? "password" : "unconfigured";
  return "dev";
}

let devSecret: string | undefined;
function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  // google·password 모드는 authMode() 가 AUTH_SECRET 을 요구하므로 여기 오지 않는다.
  // dev·unconfigured 는 임시 키를 쓴다 (dev: 서버 재시작 시 로그아웃, unconfigured: 애초에 로그인 불가).
  // 체험 모드는 서버 인스턴스가 여러 개여도 세션이 유지되도록 배포마다 고정된 키를 쓴다 (가상 데이터만 다룸)
  devSecret ??= isDemo()
    ? crypto.createHash("sha256").update(`demo:${process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_URL ?? "local"}`).digest("hex")
    : crypto.randomBytes(32).toString("hex");
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
    secure: process.env.NODE_ENV === "production" && authMode() !== "dev",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

const USER_SQL = `SELECT ${USER_COLUMNS}, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ? AND u.status != '퇴사'`;

/** 로그인하지 않았으면 null */
export async function sessionUser(): Promise<User | null> {
  const id = verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  return id ? await get<User>(USER_SQL, id) ?? null : null;
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
