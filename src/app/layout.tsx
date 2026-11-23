import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { currentUser } from "@/lib/auth";
import { isApprover, listUsers, todosFor } from "@/lib/queries";
import { switchUser } from "./actions";
import { Avatar } from "@/components/ui";

export const metadata: Metadata = { title: "벙커키즈 HR", description: "벙커키즈 인사관리시스템" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const users = listUsers({ statuses: ["재직", "수습", "휴직", "퇴사예정"] });
  const todoCount = todosFor(me.id).length;

  const switcher = (
    <form action={switchUser} className="space-y-2 px-1">
      <div className="flex items-center gap-2 px-1">
        <Avatar name={me.name} color={me.color} size={24} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{me.name}</div>
          <div className="truncate text-[11px] text-gray-400">{me.role === "admin" ? "관리자" : "구성원"}</div>
        </div>
      </div>
      {/* 개발용: 다른 구성원으로 전환 */}
      <div className="flex gap-1">
        <select name="userId" defaultValue={me.id} className="input py-1 text-xs" aria-label="사용자 전환">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.role === "admin" ? " (관리자)" : ""}
            </option>
          ))}
        </select>
        <button className="btn-secondary px-2 py-1 text-xs">전환</button>
      </div>
    </form>
  );

  return (
    <html lang="ko">
      <body>
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar isAdmin={me.role === "admin"} isApprover={isApprover(me.id)} todoCount={todoCount} userSwitcher={switcher} />
          <main className="min-w-0 flex-1 bg-white lg:my-2 lg:mr-2 lg:rounded-2xl lg:shadow-sm">{children}</main>
        </div>
      </body>
    </html>
  );
}
