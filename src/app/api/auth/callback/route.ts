import { NextResponse } from "next/server";
import { allowedDomain, authMode, createSessionValue, oauthRedirectUri } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

function fail(req: Request, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
}

/** Google OAuth 콜백: code → 토큰 → userinfo → 등록된 구성원이면 세션 발급 */
export async function GET(req: Request) {
  if (authMode() !== "google") return fail(req, "disabled");
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieState = req.headers.get("cookie")?.match(/(?:^|;\s*)hr_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) return fail(req, "state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: oauthRedirectUri(url.origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail(req, "token");
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) return fail(req, "userinfo");
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; hd?: string; name?: string };
  const email = info.email?.toLowerCase();
  if (!email || !info.email_verified) return fail(req, "unverified");
  const domain = allowedDomain();
  if (domain && info.hd !== domain && !email.endsWith(`@${domain}`)) return fail(req, "domain");

  let user = get<{ id: number }>("SELECT id FROM users WHERE lower(email) = ? AND status != '퇴사'", email);
  // 최초 배포: 아직 아무 관리자도 없고 BOOTSTRAP_ADMIN_EMAIL 이면 관리자 계정을 만든다.
  if (!user && email === process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase()) {
    const admins = get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")!.n;
    if (admins === 0) {
      const id = run("INSERT INTO users (name, email, join_date, status, role) VALUES (?, ?, ?, '재직', 'admin')", info.name ?? email, email, today());
      user = { id };
    }
  }
  if (!user) return fail(req, "not_member");

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("hr_oauth_state");
  res.cookies.set("hr_session", createSessionValue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: url.protocol === "https:",
    maxAge: 12 * 3600,
  });
  return res;
}
