import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { PrintButton } from "@/components/PrintButton";
import { StatusBadge } from "@/components/ui";
import { signContract, voidContract } from "@/app/actions";
import { CONTRACT_STATUS } from "@/lib/contracts";

type Contract = {
  id: number;
  user_id: number;
  title: string;
  body: string;
  status: string;
  created_at: string;
  signed_at: string | null;
  signer_name: string | null;
  body_hash: string;
  name: string;
};

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  const c = await get<Contract>("SELECT c.*, u.name FROM contracts c JOIN users u ON u.id = c.user_id WHERE c.id = ?", Number(id));
  if (!c || (c.user_id !== me.id && me.role !== "admin")) notFound();
  const canSign = c.user_id === me.id && c.status === "sent";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <StatusBadge status={c.status === "sent" ? "pending" : c.status === "signed" ? "approved" : "cancelled"} label={CONTRACT_STATUS[c.status]} />
        <div className="flex gap-2">
          {me.role === "admin" && c.status === "sent" && (
            <form action={voidContract}>
              <input type="hidden" name="id" value={c.id} />
              <button className="btn-danger">폐기</button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>
      <article className="print-page card px-8 py-10 sm:px-12">
        <h1 className="mb-8 text-center text-2xl font-bold">{c.title}</h1>
        <div className="whitespace-pre-line text-[14px] leading-7">{c.body}</div>
        {c.status === "signed" && (
          <div className="mt-10 rounded-lg border border-brand-100 bg-brand-50/50 p-4 text-sm">
            <p className="font-semibold text-brand-700">✔ 전자서명 완료</p>
            <p className="mt-1 text-gray-600">
              서명자 {c.signer_name} · {c.signed_at}
            </p>
            <p className="mt-1 break-all font-mono text-[11px] text-gray-400">문서 해시(SHA-256) {c.body_hash}</p>
          </div>
        )}
      </article>

      {canSign && (
        <form action={signContract} className="no-print card mt-6 space-y-3 p-6">
          <input type="hidden" name="id" value={c.id} />
          <h2 className="font-semibold">전자서명</h2>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agree" required className="mt-1" />
            위 계약 내용을 모두 확인하였으며, 전자서명으로 계약을 체결하는 것에 동의합니다.
          </label>
          <div>
            <label className="label">서명 (본인 이름 “{me.name}” 입력)</label>
            <input name="signer_name" className="input" required autoComplete="off" />
          </div>
          <button className="btn-primary w-full">서명하기</button>
        </form>
      )}
    </div>
  );
}
