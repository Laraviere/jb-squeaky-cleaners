import { RecordList } from "@/components/admin/record-list";
import type { ListParams } from "@/lib/admin/data";
export default async function TrashPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  return <RecordList kind="applications" params={await searchParams} trash />;
}
