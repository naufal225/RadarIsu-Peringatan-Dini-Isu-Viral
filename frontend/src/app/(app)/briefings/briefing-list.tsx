"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
import { PageHeader } from "@/components/radar/page-header";
import { Section } from "@/components/radar/section";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Pagination } from "@/components/radar/pagination";
import { SeverityBadge } from "@/components/radar/severity-badge";
import { Waktu } from "@/components/radar/waktu";
import { ui } from "@/lib/labels";
import { useApiData } from "@/lib/use-api-data";
import type { Severity } from "@/components/radar/types";

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
    severity: Severity;
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

export function BriefingList() {
  const [page, setPage] = useState(1);
  const { data: result, error, reload } = useApiData<BriefingResponse>(`briefings?page=${page}`);

  const columns: DataTableColumn<BriefingItem>[] = [
    {
      id: "id",
      header: "ID",
      cell: (row) => `#${row.id}`,
      mono: true,
      width: "w-20",
    },
    {
      id: "title",
      header: ui.briefings.briefingTitle,
      cell: (row) => (
        <div className="py-1">
          <span className="block font-medium text-ink">{row.title}</span>
          {row.summary && <span className="block text-caption text-ink-muted line-clamp-1">{row.summary}</span>}
        </div>
      ),
    },
    {
      id: "alert",
      header: ui.briefings.relatedAlert,
      cell: (row) => (
        <Link
          href={`/alerts/${row.alert_id}`}
          className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
        >
          {row.alert && <SeverityBadge severity={row.alert.severity} size="sm" />}
          <span>#{row.alert_id}</span>
        </Link>
      ),
      width: "w-40",
    },
    {
      id: "author",
      header: ui.briefings.author,
      cell: (row) => (
        <span className="text-table text-ink-muted">
          {row.creator?.name ?? ui.audit.system}
        </span>
      ),
      width: "w-36",
    },
    {
      id: "created_at",
      header: ui.briefings.createdAt,
      cell: (row) => <Waktu value={row.created_at} />,
      width: "w-44",
    },
    {
      id: "actions",
      header: "",
      cell: (row) =>
        row.file_path ? (
          <a
            href={`/api/briefings/${row.id}/download`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-control border border-line-input bg-panel px-2.5 py-1 text-table font-medium text-ink hover:bg-hover"
          >
            <Download className="size-3.5 text-brand" aria-hidden="true" />
            <span>{ui.briefings.download}</span>
          </a>
        ) : (
          <Link
            href={`/alerts/${row.alert_id}`}
            className="inline-flex items-center gap-1 text-table text-ink-muted hover:text-brand"
          >
            <span>{ui.alerts.viewDetail}</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        ),
      align: "right",
      width: "w-36",
    },
  ];

  return (
    <div>
      <PageHeader
        title={ui.briefings.title}
        subtitle="Daftar laporan lembar briefing situasi untuk pimpinan komando dan tindak lanjut satuan."
        icon={<FileText className="size-6 text-brand" aria-hidden="true" />}
      />

      <Section flush title="Daftar Lembar Briefing">
        <DataTable
          columns={columns}
          rows={result?.data ?? []}
          getRowKey={(row) => row.id}
          loading={result === null}
          error={error ? { title: ui.common.loadError, onRetry: reload } : null}
          empty={<p className="text-sm text-ink-muted">{ui.briefings.empty}</p>}
          caption="Tabel daftar lembar briefing"
          framed={false}
        />
        {result && result.meta.total > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={result.meta.current_page}
              perPage={result.meta.per_page}
              total={result.meta.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Section>
    </div>
  );
}
