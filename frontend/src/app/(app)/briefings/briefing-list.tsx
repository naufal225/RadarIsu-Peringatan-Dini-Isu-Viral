"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ErrorText, PageTitle, Table, Td } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
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

export function BriefingList() {
  const [page, setPage] = useState(1);
  const { data: result, error } = useApiData<BriefingResponse>(`briefings?page=${page}`);

  return (
    <>
      <PageTitle>{ui.briefings.title}</PageTitle>

      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      {result === null ? (
        <p className="text-sm text-ink-muted">{ui.loading}</p>
      ) : result.data.length === 0 ? (
        <p className="text-sm text-ink-muted">{ui.briefings.empty}</p>
      ) : (
        <>
          <Table
            head={[
              "ID",
              ui.briefings.briefingTitle,
              ui.briefings.relatedAlert,
              ui.briefings.author,
              ui.briefings.createdAt,
              "",
            ]}
          >
            {result.data.map((b) => (
              <tr key={b.id} className="hover:bg-hover">
                <Td className="font-mono text-xs">#{b.id}</Td>
                <Td>
                  <p className="font-medium text-ink">{b.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{b.summary}</p>
                </Td>
                <Td>
                  <Link
                    href={`/alerts/${b.alert_id}`}
                    className="font-mono text-xs text-brand hover:underline"
                  >
                    Alert #{b.alert_id} (
                    {b.alert?.topic?.name ?? b.alert?.subject_account?.handle ?? ui.common.none})
                  </Link>
                </Td>
                <Td>{b.creator?.name ?? ui.audit.system}</Td>
                <Td className="whitespace-nowrap text-xs text-ink-muted">
                  {formatDateTime(b.created_at)}
                </Td>
                <Td className="text-right">
                  <a
                    href={`/api/briefings/${b.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:opacity-90"
                  >
                    {ui.briefings.download}
                  </a>
                </Td>
              </tr>
            ))}
          </Table>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <Button disabled={result.meta.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
              {ui.common.previous}
            </Button>
            <span>
              {ui.common.page} {result.meta.current_page} / {result.meta.last_page} · {result.meta.total}
            </span>
            <Button
              disabled={result.meta.current_page >= result.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              {ui.common.next}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
