"use client";

import { useState } from "react";
import { AuditView, type AuditViewProps } from "@/components/audit/audit-view";
import { PageHeader } from "@/components/radar/page-header";
import { AUDIT_EMPTY, AUDIT_PAGE, AUDIT_USERS } from "@/fixtures/audit";
import type { AuditFilters } from "@/lib/api-types/audit";
import { EMPTY_AUDIT_FILTERS } from "@/lib/audit";
import { ui } from "@/lib/labels";

const noop = () => undefined;

const CASES: { title: string; props: Partial<AuditViewProps> }[] = [
  { title: ui.preview.normal, props: { result: AUDIT_PAGE } },
  { title: ui.preview.emptyFiltered, props: { result: AUDIT_EMPTY, filters: { ...EMPTY_AUDIT_FILTERS, action: "replay.stop" } } },
  { title: ui.preview.loading, props: { result: null, loading: true } },
  { title: ui.preview.error, props: { result: null, failed: true } },
  {
    title: ui.preview.invalid,
    props: { result: AUDIT_PAGE, filters: { ...EMPTY_AUDIT_FILTERS, from: "2026-10-27", to: "2026-10-20" }, filterErrors: { to: ["after_or_equal"] } },
  },
];

/** /dev/preview/audit: AuditView dengan fixture untuk setiap state. Filter kasus pertama bisa dicoba. */
export function AuditPreview() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);

  return (
    <>
      <PageHeader title={ui.preview.title(ui.audit.title)} subtitle={ui.preview.subtitle} />
      {CASES.map(({ title, props }, index) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <AuditView
            result={null}
            summary={null}
            loading={false}
            failed={false}
            onRetry={noop}
            users={AUDIT_USERS}
            filters={index === 0 ? filters : EMPTY_AUDIT_FILTERS}
            filterErrors={{}}
            onFiltersChange={index === 0 ? setFilters : noop}
            onPageChange={noop}
            {...props}
          />
        </section>
      ))}
    </>
  );
}
