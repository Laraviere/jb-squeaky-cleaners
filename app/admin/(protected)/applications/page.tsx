import type { ListParams } from "@/lib/admin/data";
import { RecordList } from "@/components/admin/record-list";
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  return <RecordList kind="applications" params={await searchParams} />;
}
