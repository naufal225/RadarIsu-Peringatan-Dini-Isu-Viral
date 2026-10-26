"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ErrorText, Field, inputClass, Section, StatusBadge, Table, Td } from "@/components/ui";
import { formatDateTime, formatDecimal } from "@/lib/format";
import { describeRules, lookalikesQuery, type LookalikesResponse } from "@/lib/impersonation";
import { alertStatusLabels, ui } from "@/lib/labels";
import { type OfficialAccount } from "@/lib/topics";
import { useApiData } from "@/lib/use-api-data";

const copy = ui.impersonation.panel;

/** Accounts that look like an official account right now, with the closest one and the rules that fired. Analysts only. */
export function LookalikesPanel() {
  const [page, setPage] = useState(1);
  const [officialId, setOfficialId] = useState<number | null>(null);
  const officials = useApiData<{ data: OfficialAccount[] }>("official-accounts");
  const { data, error } = useApiData<LookalikesResponse>(`official-accounts/lookalikes?${lookalikesQuery(page, officialId)}`);

  return (
    <Section title={copy.title}>
      <p className="mb-3 max-w-3xl text-sm text-neutral-600">{copy.intro}</p>
      <ErrorText>{error ? ui.common.loadError : null}</ErrorText>

      <div className="mb-4 max-w-xs">
        <Field label={copy.filterOfficial}>
          <select
            name="official_account_id"
            value={officialId ?? ""}
            onChange={(e) => {
              setOfficialId(e.target.value === "" ? null : Number(e.target.value));
              setPage(1);
            }}
            className={inputClass}
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

      {data === null ? (
        <p className="text-sm text-neutral-500">{ui.loading}</p>
      ) : data.meta.officials_count === 0 ? (
        <p className="text-sm text-neutral-500">{copy.noOfficials}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            {copy.asOf(formatDateTime(data.meta.as_of))} · {copy.window(formatDateTime(data.meta.window.from), formatDateTime(data.meta.window.to))} ·{" "}
            {copy.officialsCount(data.meta.officials_count)}
          </p>

          {data.data.length === 0 ? (
            <p className="text-sm text-neutral-500">{copy.empty}</p>
          ) : (
            <>
              <Table head={[copy.columns.account, copy.columns.imitates, copy.columns.similarity, copy.columns.rules, copy.columns.age, copy.columns.alert]}>
                {data.data.map((item) => {
                  const rules = describeRules(item.rules);
                  return (
                    <tr key={item.account.id}>
                      <Td>
                        <span className="font-mono text-xs">{item.account.handle}</span>
                        {item.account.display_name && <div className="text-xs text-neutral-500">{item.account.display_name}</div>}
                        <div className="text-xs text-neutral-400">{copy.firstSeen(formatDateTime(item.account.first_seen_at))}</div>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">{item.official.handle}</span>
                        <div className="text-xs text-neutral-500">{item.official.display_name}</div>
                        {item.other_matches.length > 0 && (
                          <div className="text-xs text-neutral-400">{copy.otherMatches(item.other_matches.map((m) => m.handle).join(", "))}</div>
                        )}
                      </Td>
                      <Td>
                        <strong>{formatDecimal(item.similarity, 2, 2)}</strong>
                        <div className="text-xs text-neutral-500">{copy.comparedField(copy.field[item.field])}</div>
                        {item.same_name && <StatusBadge tone="error">{copy.sameName}</StatusBadge>}
                      </Td>
                      <Td className="text-xs">
                        {rules.length === 0 ? (
                          <span className="text-neutral-500">{copy.noRules}</span>
                        ) : (
                          <ul className="list-inside list-disc">
                            {rules.map((rule) => (
                              <li key={rule}>{rule}</li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td>
                        {item.young && <StatusBadge tone="warn">{copy.young}</StatusBadge>}
                        <div className="text-xs text-neutral-500">{item.age_days === null ? copy.ageUnknown : copy.ageDays(item.age_days)}</div>
                      </Td>
                      <Td>
                        {item.alert === null ? (
                          <span className="text-xs text-neutral-500">{copy.noAlert}</span>
                        ) : (
                          <Link href={`/alerts/${item.alert.id}`} className="text-xs underline">
                            {copy.viewAlert} · {alertStatusLabels[item.alert.status as keyof typeof alertStatusLabels] ?? item.alert.status}
                          </Link>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </Table>

              <div className="mt-3 flex items-center gap-3 text-sm">
                <Button disabled={data.meta.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {ui.common.previous}
                </Button>
                <span>
                  {ui.common.page} {data.meta.current_page} / {data.meta.last_page} · {data.meta.total}
                </span>
                <Button disabled={data.meta.current_page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>
                  {ui.common.next}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Section>
  );
}
