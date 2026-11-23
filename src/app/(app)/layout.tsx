import { Sidebar } from "@/components/Sidebar";
import { authMode, currentUser } from "@/lib/auth";
import { isApprover, todosFor } from "@/lib/queries";
import { logout } from "@/app/actions";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const todoCount = todosFor(me.id).length;

  const account = (
    <div className="flex items-center gap-2 px-1">
      <Avatar name={me.name} color={me.color} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{me.name}</div>
        <div className="truncate text-[11px] text-gray-400">
          {me.role === "admin" ? "관리자" : "구성원"}
          {authMode() === "dev" && " · 개발 모드"}
        </div>
      </div>
      <form action={logout}>
        <button className="btn-secondary px-2 py-1 text-xs">로그아웃</button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar isAdmin={me.role === "admin"} isApprover={isApprover(me.id)} todoCount={todoCount} account={account} />
      <main className="min-w-0 flex-1 bg-white lg:my-2 lg:mr-2 lg:rounded-2xl lg:shadow-sm">{children}</main>
    </div>
  );
}
