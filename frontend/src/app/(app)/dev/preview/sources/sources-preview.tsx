"use client";

import { useState } from "react";
import { PageHeader } from "@/components/radar/page-header";
import { SourcesView, type ImportState, type SourceFormState, type SourcesViewProps } from "@/components/sources/sources-view";
import { IMPORT_RESULT, SOURCE_LIST, SOURCES } from "@/fixtures/sources";
import { ui } from "@/lib/labels";
import { emptySourceForm, formFromSource } from "@/lib/sources";

const noop = () => undefined;
const CLOSED_FORM: SourceFormState = { open: false, mode: "create", sourceId: null, values: emptySourceForm(), errors: {}, pending: false, failed: false };
const CLOSED_IMPORT: ImportState = { source: null, pending: false, result: null, fileErrors: [], failed: false, history: null };

const BASE: SourcesViewProps = {
  result: SOURCE_LIST,
  loading: false,
  failed: false,
  onRetry: noop,
  canManage: true,
  busyId: null,
  rowNotice: null,
  onTest: noop,
  onToggle: noop,
  onEdit: noop,
  onNew: noop,
  onImport: noop,
  form: CLOSED_FORM,
  onFormChange: noop,
  onFormSubmit: noop,
  onFormClose: noop,
  imports: CLOSED_IMPORT,
  onImportSubmit: noop,
  onImportClose: noop,
};

const CASES: { title: string; props: Partial<SourcesViewProps> }[] = [
  { title: ui.preview.normal, props: { rowNotice: { id: 2, tone: "error", text: ui.sources.testFailed(SOURCES[2].name) } } },
  { title: `${ui.preview.normal} · ${ui.common.no} ${ui.sources.actions}`, props: { canManage: false } },
  { title: ui.preview.empty, props: { result: { data: [] } } },
  { title: ui.preview.loading, props: { result: null, loading: true } },
  { title: ui.preview.error, props: { result: null, failed: true } },
];

/** /dev/preview/sources: SourcesView dengan fixture. Kasus pertama interaktif: dialog ubah, tambah (422), dan impor. */
export function SourcesPreview() {
  const [form, setForm] = useState<SourceFormState>(CLOSED_FORM);
  const [imports, setImports] = useState<ImportState>(CLOSED_IMPORT);

  return (
    <>
      <PageHeader title={ui.preview.title(ui.sources.title)} subtitle={ui.preview.subtitle} />
      {CASES.map(({ title, props }, index) => (
        <section key={title} className="mb-12 border-t border-line pt-6">
          <h2 className="mb-4 text-section font-semibold text-ink-muted">{title}</h2>
          <SourcesView
            {...BASE}
            {...(index === 0
              ? {
                  form,
                  onFormChange: (values) => setForm((f) => ({ ...f, values })),
                  onFormClose: () => setForm(CLOSED_FORM),
                  onFormSubmit: () => setForm((f) => ({ ...f, errors: { url: ["URL tidak valid"], interval_minutes: ["Minimal 5"] } })),
                  onEdit: (s) => setForm({ ...CLOSED_FORM, open: true, mode: "edit", sourceId: s.id, values: formFromSource(s) }),
                  onNew: () => setForm({ ...CLOSED_FORM, open: true, values: emptySourceForm("rss") }),
                  imports,
                  onImport: (s) => setImports({ ...CLOSED_IMPORT, source: s, result: IMPORT_RESULT, history: [IMPORT_RESULT] }),
                  onImportClose: () => setImports(CLOSED_IMPORT),
                }
              : {})}
            {...props}
          />
        </section>
      ))}
    </>
  );
}
