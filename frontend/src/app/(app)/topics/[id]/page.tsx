import { notFound } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { TopicDetail } from "./topic-detail";

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return (
    <RequirePermission permission="topics.view">
      <TopicDetail id={Number(id)} />
    </RequirePermission>
  );
}
