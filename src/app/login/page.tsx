import { redirect } from "next/navigation";
import { authMode, sessionUser } from "@/lib/auth";
import { listUsers } from "@/lib/queries";
import { devLogin } from "@/app/actions";

const ERRORS: Record<string, string> = {
  state: "로그인 요청이 만료되었어요. 다시 시도해주세요.",
  token: "Google 인증에 실패했어요.",
  userinfo: "Google 계정 정보를 가져오지 못했어요.",
  unverified: "이메일 인증이 완료된 Google 계정만 사용할 수 있어요.",
  domain: "회사 Google Workspace 계정으로 로그인해주세요.",
  not_member: "등록된 구성원이 아니에요. 인사 담당자에게 계정 등록을 요청해주세요.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await sessionUser()) redirect("/");
  const { error } = await searchParams;
  const mode = authMode();
  const users = mode === "dev" ? listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] }) : [];

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5 text-lg font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ink-900">B</span>
          벙커키즈 HR
        </div>
        <div>
          <h2 className="text-[34px] font-bold leading-tight tracking-tight">
            근무, 휴가, 급여까지
            <br />
            한 곳에서.
          </h2>
          <p className="mt-4 max-w-sm text-ink-300">휴가 신청과 결재, 전자계약, 임금명세서, 증명서 발급을 벙커키즈 HR에서 처리하세요.</p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-sm">
            {["연차 자동 산정", "전자 결재", "임금명세서"].map((x) => (
              <div key={x} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-ink-200">
                {x}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-500">© 주식회사 벙커키즈</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-lg font-bold lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">B</span>
            벙커키즈 HR
          </div>
          <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
          <p className="mb-6 mt-1 text-sm text-ink-500">
            {mode === "google" ? "회사 Google Workspace 계정으로 로그인하세요." : "개발 모드: 구성원을 골라 로그인하세요."}
          </p>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">{ERRORS[error] ?? "로그인에 실패했어요."}</p>}
          {mode === "google" ? (
            <a href="/api/auth/google" className="btn-secondary h-11 w-full text-[15px]">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Google 계정으로 로그인
            </a>
          ) : (
            <form action={devLogin} className="space-y-3">
              <select name="userId" className="input h-11" aria-label="구성원 선택">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.role === "admin" ? " (관리자)" : ""} · {u.title ?? ""}
                  </option>
                ))}
              </select>
              <button className="btn-primary h-11 w-full text-[15px]">로그인</button>
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-700">
                GOOGLE_CLIENT_ID 를 설정하면 Google 로그인으로 바뀝니다. 개발 모드의 데이터는 모두 가상입니다.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
