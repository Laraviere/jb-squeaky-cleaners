import type { ListParams } from "@/lib/admin/data";
import { RecordList } from "@/components/admin/record-list";
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  return <RecordList kind="quotes" params={await searchParams} />;
}
