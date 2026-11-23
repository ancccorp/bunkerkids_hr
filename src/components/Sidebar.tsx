"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Clock,
  FileBadge,
  FileText,
  House,
  Megaphone,
  Menu,
  Palmtree,
  PenLine,
  Settings,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

export function Sidebar({
  isAdmin,
  isApprover,
  todoCount,
  signCount,
  companyName,
  account,
}: {
  isAdmin: boolean;
  isApprover: boolean;
  todoCount: number;
  signCount: number;
  companyName: string;
  account: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const main: Item[] = [
    { href: "/", label: "홈", icon: House, badge: todoCount },
    { href: "/notices", label: "공지", icon: Megaphone },
    { href: "/people", label: "구성원", icon: Users },
    { href: "/work", label: "근무", icon: Clock },
    { href: "/time-off", label: "휴가", icon: Palmtree },
    { href: "/workflow", label: "워크플로우", icon: FileText },
    { href: "/contracts", label: "전자계약", icon: PenLine, badge: signCount },
    { href: "/payroll", label: "급여", icon: Wallet },
    { href: "/certificates", label: "증명서", icon: FileBadge },
  ];
  const admin: Item[] = [
    ...(isAdmin ? [{ href: "/people/manage", label: "구성원 관리", icon: UserCog }] : []),
    ...(isAdmin || isApprover ? [{ href: "/time-off/manage", label: "휴가 관리", icon: CalendarCheck }] : []),
    ...(isAdmin ? [{ href: "/settings", label: "설정", icon: Settings }] : []),
  ];
  const all = [...main, ...admin];
  // 가장 길게 일치하는 메뉴 하나만 활성화 (/people 과 /people/manage 구분)
  const active = all
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const link = (i: Item) => {
    const on = active === i.href;
    const Icon = i.icon;
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={on ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
          on ? "bg-white font-semibold text-ink-900 shadow-card ring-1 ring-ink-200/70" : "text-ink-600 hover:bg-white/60 hover:text-ink-900"
        }`}
      >
        <Icon size={18} strokeWidth={on ? 2.2 : 1.8} className={on ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"} />
        <span className="flex-1">{i.label}</span>
        {!!i.badge && (
          <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{i.badge}</span>
        )}
      </Link>
    );
  };

  const nav = (
    <nav className="flex h-full flex-col p-3">
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2 pt-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink-900 text-sm font-bold text-white">B</span>
        <span className="leading-tight">
          <span className="block text-[15px] font-bold">벙커키즈 HR</span>
          <span className="block text-[11px] text-ink-500">{companyName}</span>
        </span>
      </Link>
      <div className="space-y-0.5">{main.map(link)}</div>
      {admin.length > 0 && (
        <>
          <div className="mb-1.5 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">관리</div>
          <div className="space-y-0.5">{admin.map(link)}</div>
        </>
      )}
      <div className="mt-auto border-t border-ink-200 pt-3">{account}</div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-200 bg-ink-100/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-xs text-white">B</span>
          벙커키즈 HR
        </Link>
        <button className="btn-ghost h-9 w-9 p-0" onClick={() => setOpen(true)} aria-label="메뉴 열기">
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink-900/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="relative h-full w-72 bg-ink-100" onClick={(e) => e.stopPropagation()}>
            <button className="btn-ghost absolute right-2 top-3 h-8 w-8 p-0" onClick={() => setOpen(false)} aria-label="메뉴 닫기">
              <X size={18} />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto lg:block">{nav}</aside>
    </>
  );
}
