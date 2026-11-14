"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { controlClass, Field } from "@/components/radar/form";
import { Pagination } from "@/components/radar/pagination";
import { Section } from "@/components/radar/section";
import { Tag } from "@/components/radar/tag";
import { ErrorState } from "@/components/radar/states";
import { Waktu } from "@/components/radar/waktu";
import { formatDecimal } from "@/lib/format";
import { describeRules, lookalikesQuery, type Lookalike, type LookalikesResponse } from "@/lib/impersonation";
import { alertStatusLabels, ui } from "@/lib/labels";
import { type OfficialAccount } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.impersonation.panel;

function columns(): DataTableColumn<Lookalike>[] {
  return [
    {
      id: "account",
      header: copy.columns.account,
      cell: (item) => (
        <>
          <span className="block font-mono text-caption text-ink">{item.account.handle}</span>
          {item.account.display_name && <span className="block text-caption text-ink-muted">{item.account.display_name}</span>}
          <span className="block text-caption text-ink-muted">
            {copy.firstSeenPrefix} <Waktu value={item.account.first_seen_at} />
          </span>
        </>
      ),
    },
    {
      id: "imitates",
      header: copy.columns.imitates,
      cell: (item) => (
        <>
          <span className="block font-mono text-caption text-ink">{item.official.handle}</span>
          <span className="block text-caption text-ink-muted">{item.official.display_name}</span>
          {item.other_matches.length > 0 && (
            <span className="block text-caption text-ink-muted">{copy.otherMatches(item.other_matches.map((m) => m.handle).join(", "))}</span>
          )}
        </>
      ),
    },
    {
      id: "similarity",
      header: copy.columns.similarity,
      cell: (item) => (
        <>
          <span className="block font-semibold tabular-nums text-ink">{formatDecimal(item.similarity, 2, 2)}</span>
          <span className="block text-caption text-ink-muted">{copy.comparedField(copy.field[item.field])}</span>
          {item.same_name && <Tag tone="danger">{copy.sameName}</Tag>}
        </>
      ),
    },
    {
      id: "rules",
      header: copy.columns.rules,
      cell: (item) => {
        const rules = describeRules(item.rules);
        if (rules.length === 0) return <span className="text-ink-muted">{copy.noRules}</span>;
        return (
          <ul className="list-inside list-disc text-caption">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        );
      },
    },
    {
      id: "age",
      header: copy.columns.age,
      cell: (item) => (
        <>
          {item.young && <Tag tone="warn">{copy.young}</Tag>}
          <span className="mt-1 block text-caption text-ink-muted">
            {item.age_days === null ? copy.ageUnknown : copy.ageDays(item.age_days)}
          </span>
        </>
      ),
    },
    {
      id: "alert",
      header: copy.columns.alert,
      cell: (item) =>
        item.alert === null ? (
          <span className="text-caption text-ink-muted">{copy.noAlert}</span>
        ) : (
          <Link href={`/alerts/${item.alert.id}`} className="text-caption text-brand underline-offset-2 hover:underline">
            {copy.viewAlert} · {alertStatusLabels[item.alert.status as keyof typeof alertStatusLabels] ?? item.alert.status}
          </Link>
        ),
    },
  ];
}

/** Akun yang tampak mirip akun resmi saat ini, dengan akun resmi terdekat dan aturan yang terpicu. Hanya analis. */
export function LookalikesPanel() {
  const [page, setPage] = useState(1);
  const [officialId, setOfficialId] = useState<number | null>(null);
  const officials = useApiData<{ data: OfficialAccount[] }>("official-accounts");
  const { data, error, reload } = useApiData<LookalikesResponse>(`official-accounts/lookalikes?${lookalikesQuery(page, officialId)}`);

  return (
    <Section title={copy.title} description={copy.intro}>
      {error ? (
        <ErrorState onRetry={reload} />
      ) : data === null ? (
        <p className="text-table text-ink-muted">{ui.loading}</p>
      ) : data.meta.officials_count === 0 ? (
        <p className="text-table text-ink-muted">{copy.noOfficials}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="w-full max-w-xs">
              <Field label={copy.filterOfficial}>
                <select
                  name="official_account_id"
                  value={officialId ?? ""}
                  onChange={(e) => {
                    setOfficialId(e.target.value === "" ? null : Number(e.target.value));
                    setPage(1);
                  }}
                  className={controlClass}
                >
                  <option value="">{copy.allOfficials}</option>
                  {(officials.data?.data ?? []).map((official) => (
                    <option key={official.id} value={official.id}>
                      {official.handle}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-caption text-ink-muted">
              {copy.asOfPrefix} <Waktu value={data.meta.as_of} /> · {copy.windowFrom} <Waktu value={data.meta.window.from} />{" "}
              {copy.windowTo} <Waktu value={data.meta.window.to} /> · {copy.officialsCount(data.meta.officials_count)}
            </p>
          </div>

          <DataTable
            caption={copy.title}
            columns={columns()}
            rows={data.data}
            getRowKey={(item) => item.account.id}
            framed={false}
            empty={<p className="text-table text-ink-muted">{copy.empty}</p>}
          />

          {data.meta.last_page > 1 && (
            <Pagination page={data.meta.current_page} perPage={data.meta.per_page} total={data.meta.total} onPageChange={setPage} />
          )}
        </div>
      )}
    </Section>
  );
}
