import { RecordDetail } from "@/components/admin/record-detail";
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RecordDetail kind="applications" id={(await params).id} />;
}
