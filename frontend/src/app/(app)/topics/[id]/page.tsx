import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Can } from "@/components/permissions-provider";
import { RequirePermission } from "@/components/require-permission";
import { ui } from "@/lib/labels";
import { CoordinationPanel } from "./coordination-panel";
import { TopicData } from "./topic-data";

export default function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-ink-muted">{ui.loading}</p>}>
      <TopicDetailContent params={params} />
    </Suspense>
  );
}

async function TopicDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return (
    <RequirePermission permission="topics.view">
      <TopicData id={Number(id)} />
      {/* Names accounts and quotes posts: the API allows analysts only, this just hides the section. */}
      <Can permission="alerts.triage">
        <CoordinationPanel id={Number(id)} />
      </Can>
    </RequirePermission>
  );
}
