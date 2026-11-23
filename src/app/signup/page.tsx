import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { allowedDomain, authMode, sessionUser } from "@/lib/auth";
import { signup } from "@/app/actions";

const ERRORS: Record<string, string> = {
  missing: "이름과 이메일을 입력해주세요.",
  email: "이메일 형식을 확인해주세요.",
  domain: "회사 이메일로만 가입할 수 있어요.",
  mismatch: "비밀번호 확인이 일치하지 않아요.",
  weak: "비밀번호는 8자 이상, 영문과 숫자를 모두 넣어주세요.",
  exists: "이미 가입된 이메일이에요. 비밀번호를 잊었다면 관리자에게 로그인 초기화를 요청하세요.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  if (authMode() !== "password") redirect("/login");
  if (await sessionUser()) redirect("/");
  const { error, done } = await searchParams;
  const domain = allowedDomain();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-100 p-4">
      <div className="card w-full max-w-md p-8">
        <Link href="/login" className="mb-8 flex items-center gap-2 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">B</span>
          벙커키즈 HR
        </Link>

        {done ? (
          <div className="text-center">
            <CircleCheck size={40} className="mx-auto text-brand-600" />
            <h1 className="mt-4 text-xl font-bold">가입 요청을 보냈어요</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              관리자가 승인하면 입력한 이메일과 비밀번호로 로그인할 수 있어요.
              <br />
              급하면 인사 담당자에게 승인을 요청해주세요.
            </p>
            <Link href="/login" className="btn-secondary mt-6 w-full">
              로그인 화면으로
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">회원가입</h1>
            <p className="mb-6 mt-1 text-sm text-ink-500">가입 후 관리자 승인이 끝나면 로그인할 수 있어요.</p>
            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">{ERRORS[error] ?? "가입에 실패했어요."}</p>}
            <form action={signup} className="space-y-3">
              <div>
                <label className="label" htmlFor="name">
                  이름 (사내에서 쓰는 이름)
                </label>
                <input id="name" name="name" className="input h-11" autoComplete="name" required maxLength={40} />
              </div>
              <div>
                <label className="label" htmlFor="email">
                  회사 이메일
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="input h-11"
                  autoComplete="username"
                  placeholder={domain ? `name@${domain}` : "name@company.com"}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  비밀번호 (8자 이상, 영문+숫자)
                </label>
                <input id="password" name="password" type="password" className="input h-11" autoComplete="new-password" required minLength={8} />
              </div>
              <div>
                <label className="label" htmlFor="password2">
                  비밀번호 확인
                </label>
                <input id="password2" name="password2" type="password" className="input h-11" autoComplete="new-password" required minLength={8} />
              </div>
              <button className="btn-primary h-11 w-full text-[15px]">가입 요청</button>
            </form>
            <p className="mt-5 text-center text-sm text-ink-500">
              이미 계정이 있나요?{" "}
              <Link href="/login" className="font-semibold text-brand-600 hover:underline">
                로그인
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
