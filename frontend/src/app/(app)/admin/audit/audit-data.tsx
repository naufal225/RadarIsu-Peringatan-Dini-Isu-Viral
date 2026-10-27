"use client";

import { useState } from "react";
import { AuditView } from "@/components/audit/audit-view";
import type { AuditFilters, AuditPage, UserOption } from "@/lib/api-types/audit";
import { auditQuery, EMPTY_AUDIT_FILTERS, filterErrors } from "@/lib/audit";
import { useApiData } from "@/lib/use-api-data";

/** Pengambil data /admin/audit: filter dan halaman di state, tampilan di AuditView. */
export function AuditData() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const { data, error, status, errorBody, loading, reload } = useApiData<AuditPage>(auditQuery(filters, page));

  // Hanya untuk pilihan filter; daftar audit tetap jalan tanpa ini.
  const users = useApiData<{ data: UserOption[] }>("users?per_page=100").data?.data ?? [];

  const invalid = status === 422;

  return (
    <AuditView
      result={data}
      loading={loading}
      failed={error && !invalid}
      onRetry={reload}
      users={users}
      filters={filters}
      filterErrors={invalid ? filterErrors(errorBody) : {}}
      onFiltersChange={(next) => {
        setFilters(next);
        setPage(1);
      }}
      onPageChange={setPage}
    />
  );
}
