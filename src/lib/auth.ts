import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "./db";
import type { User } from "./queries";

export const USER_COOKIE = "hr_user";

/**
 * 개발용 인증: 쿠키에 저장된 구성원으로 동작한다.
 * TODO: 운영 전 Google Workspace SSO 등 실제 인증으로 교체.
 */
export async function currentUser(): Promise<User> {
  const jar = await cookies();
  const id = Number(jar.get(USER_COOKIE)?.value);
  const user =
    (id && get<User>("SELECT u.*, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?", id)) ||
    get<User>("SELECT u.*, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.role = 'admin' ORDER BY u.id DESC LIMIT 1");
  if (!user) throw new Error("No users in database");
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
