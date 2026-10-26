import { notFound } from "next/navigation";
import { Can } from "@/components/permissions-provider";
import { RequirePermission } from "@/components/require-permission";
import { CoordinationPanel } from "./coordination-panel";
import { TopicDetail } from "./topic-detail";

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return (
    <RequirePermission permission="topics.view">
      <TopicDetail id={Number(id)} />
      {/* Names accounts and quotes posts: the API allows analysts only, this just hides the section. */}
      <Can permission="alerts.triage">
        <CoordinationPanel id={Number(id)} />
      </Can>
    </RequirePermission>
  );
}
