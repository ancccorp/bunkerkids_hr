import { requireAdmin } from "@/lib/auth";
import { listDepartments } from "@/lib/queries";
import { PageShell } from "@/components/ui";
import { MemberForm } from "@/components/MemberForm";

export default async function NewMemberPage() {
  await requireAdmin();
  return (
    <PageShell>
      <h1 className="page-title mb-6">구성원 추가</h1>
      <div className="card max-w-3xl p-6">
        <MemberForm departments={await listDepartments()} />
      </div>
    </PageShell>
  );
}
