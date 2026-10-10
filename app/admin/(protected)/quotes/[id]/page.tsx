import { RecordDetail } from "@/components/admin/record-detail";
export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RecordDetail kind="quotes" id={(await params).id} />;
}
