import { LogOut } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { authMode, currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { isApprover, todosFor } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const todoCount = (await todosFor(me.id)).length;
  const signCount = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM contracts WHERE user_id = ? AND status = 'sent'", me.id))!.n;

  const account = (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
      <Avatar name={me.name} color={me.color} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{me.name}</div>
        <div className="truncate text-[11px] text-ink-500">
          {me.title ?? (me.role === "admin" ? "관리자" : "구성원")}
          {authMode() === "dev" && " · 개발 모드"}
        </div>
      </div>
      <form action={logout}>
        <button className="btn-ghost h-8 w-8 p-0" aria-label="로그아웃" title="로그아웃">
          <LogOut size={16} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        isAdmin={me.role === "admin"}
        isApprover={await isApprover(me.id)}
        todoCount={todoCount}
        signCount={signCount}
        companyName={(await getSettings()).company_name}
        account={account}
      />
      <main className="min-w-0 flex-1 bg-white lg:my-2 lg:mr-2 lg:rounded-2xl lg:border lg:border-ink-200/70 lg:shadow-card">{children}</main>
    </div>
  );
}
