import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { allowedDomain, authMode, oauthRedirectUri } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Google 로그인 시작: state 쿠키를 심고 Google 동의 화면으로 보낸다. */
export async function GET(req: Request) {
  if (authMode() !== "google") return NextResponse.redirect(new URL("/login", req.url));
  const state = crypto.randomBytes(16).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: oauthRedirectUri(new URL(req.url).origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  if (allowedDomain()) params.set("hd", allowedDomain());
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("hr_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: req.url.startsWith("https") });
  return res;
}
