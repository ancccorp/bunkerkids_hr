import Link from "next/link";

export function Avatar({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  재직: "bg-brand-50 text-brand-700",
  수습: "bg-amber-50 text-amber-700",
  휴직: "bg-sky-50 text-sky-700",
  퇴사예정: "bg-orange-50 text-orange-700",
  퇴사: "bg-gray-100 text-gray-500",
  입사예정: "bg-violet-50 text-violet-700",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-brand-50 text-brand-700",
  rejected: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  waiting: "bg-gray-100 text-gray-500",
  draft: "bg-amber-50 text-amber-700",
  confirmed: "bg-brand-50 text-brand-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "승인대기",
  approved: "승인완료",
  rejected: "반려",
  cancelled: "취소",
  waiting: "대기",
  draft: "작성중",
  confirmed: "확정",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={t.active ? "tab-active" : "tab"}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function SubTabs({ items }: { items: { href: string; label: string; active?: boolean }[] }) {
  return (
    <div className="flex gap-6 border-b border-gray-200">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${t.active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-xs text-gray-500">
      <span>{title}</span>
      {href && (
        <Link href={href} className="hover:text-gray-800">
          더 보기
        </Link>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-gray-400">{children}</div>;
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>;
}
