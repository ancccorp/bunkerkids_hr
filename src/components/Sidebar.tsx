"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: string; admin?: boolean; badge?: number; indent?: boolean };

export function Sidebar({
  isAdmin,
  isApprover,
  todoCount,
  account,
}: {
  isAdmin: boolean;
  isApprover: boolean;
  todoCount: number;
  account: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: Item[] = [
    { href: "/", label: "홈 피드", icon: "🏠", badge: todoCount },
    { href: "/notices", label: "공지", icon: "📢" },
    { href: "/people", label: "구성원", icon: "👥" },
    { href: "/people/manage", label: "구성원 관리", icon: "🗂️", admin: true },
    { href: "/work", label: "근무", icon: "⏱️" },
    { href: "/time-off", label: "휴가", icon: "🌴" },
    { href: "/time-off/manage", label: "휴가 관리", icon: "✅", admin: !isApprover },
    { href: "/workflow", label: "워크플로우", icon: "📝" },
    { href: "/contracts", label: "전자계약", icon: "✍️" },
    { href: "/payroll", label: "급여", icon: "💰" },
    { href: "/certificates", label: "증명서", icon: "📄" },
    { href: "/settings", label: "설정", icon: "⚙️", admin: true },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || (pathname.startsWith(href + "/") && !items.some((i) => i.href !== href && i.href.startsWith(href) && pathname.startsWith(i.href)));

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link href="/" className="mb-3 flex items-center gap-2 px-2 py-1 text-[15px] font-bold" onClick={() => setOpen(false)}>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-sm text-white">B</span>
        벙커키즈 HR
      </Link>
      {items
        .filter((i) => !i.admin || isAdmin)
        .map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              isActive(i.href) ? "bg-gray-200/70 font-semibold text-gray-900" : "text-gray-600 hover:bg-gray-200/40"
            }`}
          >
            <span className="w-5 text-center" aria-hidden>
              {i.icon}
            </span>
            <span className="flex-1">{i.label}</span>
            {!!i.badge && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{i.badge}</span>}
          </Link>
        ))}
      <div className="mt-auto border-t border-gray-200 pt-3">{account}</div>
    </nav>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 lg:hidden">
        <span className="font-bold">벙커키즈 HR</span>
        <button className="btn-secondary px-2 py-1" onClick={() => setOpen(!open)} aria-label="메뉴">
          ☰
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64 bg-gray-50" onClick={(e) => e.stopPropagation()}>
            {nav}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-gray-50 lg:block">{nav}</aside>
    </>
  );
}
