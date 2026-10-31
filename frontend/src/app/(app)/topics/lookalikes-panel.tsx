"use client";

import Link from "next/link";
import { useState } from "react";
import { Users } from "lucide-react";
import { Section } from "@/components/radar/section";
import { DataTable, type DataTableColumn } from "@/components/radar/data-table";
import { Pagination } from "@/components/radar/pagination";
import { Waktu } from "@/components/radar/waktu";
import { controlClass, Field } from "@/components/radar/form";
import { ErrorState } from "@/components/radar/states";
import { formatDecimal } from "@/lib/format";
import { describeRules, lookalikesQuery, type Lookalike, type LookalikesResponse } from "@/lib/impersonation";
import { alertStatusLabels, ui } from "@/lib/labels";
import { type OfficialAccount } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.impersonation.panel;

/** Accounts that look like an official account right now, with the closest one and the rules that fired. Analysts only. */
export function LookalikesPanel() {
  const [page, setPage] = useState(1);
  const [officialId, setOfficialId] = useState<number | null>(null);
  const officials = useApiData<{ data: OfficialAccount[] }>("official-accounts");
  const { data, error, reload } = useApiData<LookalikesResponse>(`official-accounts/lookalikes?${lookalikesQuery(page, officialId)}`);

  const columns: DataTableColumn<Lookalike>[] = [
    {
      id: "account",
      header: copy.columns.account,
      cell: (row) => (
        <div className="py-1">
          <span className="font-mono text-table font-medium text-ink">@{row.account.handle}</span>
          {row.account.display_name && <div className="text-caption text-ink-muted">{row.account.display_name}</div>}
          <div className="text-caption text-ink-muted">
            {copy.firstSeen("")} <Waktu value={row.account.first_seen_at} />
          </div>
        </div>
      ),
    },
    {
      id: "imitates",
      header: copy.columns.imitates,
      cell: (row) => (
        <div className="py-1">
          <span className="font-mono text-table font-medium text-brand">@{row.official.handle}</span>
          <div className="text-caption text-ink-muted">{row.official.display_name}</div>
          {row.other_matches.length > 0 && (
            <div className="text-caption text-ink-muted">{copy.otherMatches(row.other_matches.map((m) => `@${m.handle}`).join(", "))}</div>
          )}
        </div>
      ),
    },
    {
      id: "similarity",
      header: copy.columns.similarity,
      cell: (row) => (
        <div>
          <strong className="font-mono text-table font-semibold tabular-nums text-ink">{formatDecimal(row.similarity, 2, 2)}</strong>
          <div className="text-caption text-ink-muted">{copy.comparedField(copy.field[row.field])}</div>
          {row.same_name && (
            <span className="mt-1 inline-block rounded-badge border border-sev-high/30 bg-sev-high-bg px-1.5 py-0.2 text-[11px] font-semibold text-sev-high">
              {copy.sameName}
            </span>
          )}
        </div>
      ),
      width: "w-32",
    },
    {
      id: "rules",
      header: copy.columns.rules,
      cell: (row) => {
        const rules = describeRules(row.rules);
        return rules.length === 0 ? (
          <span className="text-caption text-ink-muted">{copy.noRules}</span>
        ) : (
          <ul className="list-inside list-disc text-caption text-ink">
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
      cell: (row) => (
        <div>
          {row.young && (
            <span className="mb-1 inline-block rounded-badge border border-sev-medium/30 bg-sev-medium-bg px-1.5 py-0.2 text-[11px] font-semibold text-sev-medium">
              {copy.young}
            </span>
          )}
          <div className="text-caption text-ink-muted">{row.age_days === null ? copy.ageUnknown : copy.ageDays(row.age_days)}</div>
        </div>
      ),
      width: "w-28",
    },
    {
      id: "alert",
      header: copy.columns.alert,
      cell: (row) =>
        row.alert === null ? (
          <span className="text-caption text-ink-muted">{copy.noAlert}</span>
        ) : (
          <Link href={`/alerts/${row.alert.id}`} className="text-table font-medium text-brand hover:underline">
            <span>{copy.viewAlert}</span> · <span>{alertStatusLabels[row.alert.status as keyof typeof alertStatusLabels] ?? row.alert.status}</span>
          </Link>
        ),
      width: "w-36",
    },
  ];

  return (
    <Section title={copy.title} description={copy.intro} icon={<Users className="size-5 text-brand" aria-hidden="true" />}>
      {error && (
        <div className="mb-4">
          <ErrorState title={ui.common.loadError} onRetry={reload} />
        </div>
      )}

      <div className="mb-4 max-w-xs">
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
                @{official.handle}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {data === null ? (
        <p className="text-sm text-ink-muted">{ui.loading}</p>
      ) : data.meta.officials_count === 0 ? (
        <p className="text-sm text-ink-muted">{copy.noOfficials}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-caption text-ink-muted">
            {copy.asOf("")} <Waktu value={data.meta.as_of} /> ·{" "}
            {copy.window("", "")}: <Waktu value={data.meta.window.from} /> – <Waktu value={data.meta.window.to} /> ·{" "}
            {copy.officialsCount(data.meta.officials_count)}
          </p>

          <DataTable
            columns={columns}
            rows={data.data}
            getRowKey={(item) => item.account.id}
            empty={<p className="text-sm text-ink-muted">{copy.empty}</p>}
            caption="Tabel akun terduga tiruan"
          />

          {data.meta.total > 0 && (
            <div className="mt-3">
              <Pagination
                page={data.meta.current_page}
                perPage={data.meta.per_page}
                total={data.meta.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
