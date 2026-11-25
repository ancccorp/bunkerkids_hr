import Link from "next/link";
import { ChevronRight, Inbox, type LucideIcon } from "lucide-react";

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
    <div className="flex gap-6 overflow-x-auto border-b border-ink-200">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px shrink-0 border-b-2 pb-3 text-sm font-semibold ${t.active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
      <span className="section-title">
        {title}
        {count != null && <span className="ml-1.5 text-ink-400">{count}</span>}
      </span>
      {href && (
        <Link href={href} className="flex items-center text-xs font-medium text-ink-500 hover:text-ink-900">
          전체 보기 <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

export function Empty({ children, icon: Icon = Inbox }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-ink-400">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100">
        <Icon size={18} className="text-ink-400" />
      </span>
      {children}
    </div>
  );
}

/** 페이지 제목 + 설명 + 우측 액션 */
export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  brand: "bg-brand-50 text-brand-600",
  violet: "bg-leave-100 text-leave-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
  ink: "bg-ink-100 text-ink-600",
};

/** 대시보드 요약 지표 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "ink",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 text-[22px] font-bold leading-none tracking-tight text-ink-900 sm:text-[26px]">{value}</div>
      {sub && <div className="mt-2 truncate text-xs text-ink-500">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition sm:p-5 hover:-translate-y-0.5 hover:shadow-pop">
      {body}
    </Link>
  ) : (
    <div className="card p-4 sm:p-5">{body}</div>
  );
}

/** 가로 막대 (조직별 인원 등) */
export function Bar({ label, value, max, color = "bg-brand-500" }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 truncate text-ink-600">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </span>
      <span className="w-8 text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>;
}
