"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { PageHeader } from "@/components/radar/page-header";
import { Pagination } from "@/components/radar/pagination";
import { EmptyState, ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";

type BriefingItem = {
  id: number;
  alert_id: number;
  title: string;
  summary: string;
  file_path: string | null;
  created_at: string;
  creator: { id: number; name: string } | null;
  alert: {
    id: number;
    kind: string;
    status: string;
    score: number;
    severity: string;
    topic: { id: number; name: string } | null;
    subject_account: { id: number; handle: string } | null;
  } | null;
};

type BriefingResponse = {
  data: BriefingItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

const COLUMNS: DataTableColumn<BriefingItem>[] = [
  { id: "id", header: "ID", mono: true, cell: (b) => `#${b.id}` },
  {
    id: "title",
    header: ui.briefings.briefingTitle,
    cell: (b) => (
      <>
        <span className="block font-medium text-ink">{b.title}</span>
        <span className="mt-0.5 line-clamp-1 block text-caption text-ink-muted">{b.summary}</span>
      </>
    ),
  },
  {
    id: "alert",
    header: ui.briefings.relatedAlert,
    cell: (b) => (
      <Link href={`/alerts/${b.alert_id}`} className="font-mono text-caption text-brand hover:underline">
        Alert #{b.alert_id} ({b.alert?.topic?.name ?? b.alert?.subject_account?.handle ?? ui.common.none})
      </Link>
    ),
  },
  { id: "author", header: ui.briefings.author, cell: (b) => b.creator?.name ?? ui.audit.system },
  { id: "created", header: ui.briefings.createdAt, cell: (b) => <Waktu value={b.created_at} /> },
  {
    id: "download",
    header: "",
    align: "right",
    cell: (b) => (
      <a
        href={`/api/briefings/${b.id}/download`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center rounded-control bg-brand px-3 text-table font-medium text-brand-fg hover:opacity-90"
      >
        {ui.briefings.download}
      </a>
    ),
  },
];

export function BriefingList() {
  const [page, setPage] = useState(1);
  const { data: result, error, reload } = useApiData<BriefingResponse>(`briefings?page=${page}`);

  return (
    <div className="space-y-6">
      <PageHeader title={ui.briefings.title} />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : result !== null && result.data.length === 0 ? (
        <EmptyState title={ui.briefings.empty} />
      ) : (
        <>
          <DataTable
            caption={ui.briefings.title}
            columns={COLUMNS}
            rows={result?.data ?? []}
            getRowKey={(b) => b.id}
            loading={result === null}
          />
          {result && result.meta.last_page > 1 && (
            <Pagination
              page={page}
              perPage={result.meta.per_page}
              total={result.meta.total}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
