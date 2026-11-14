"use client";

import { useState } from "react";
import {
  AlertListView,
  EMPTY_ALERT_FILTERS,
  type AlertFilters,
  type AlertItem,
  type AlertPageMeta,
} from "@/components/alerts/alert-list-view";
import { useApiData } from "@/lib/use-api-data";

type AlertResponse = {
  data: AlertItem[];
  meta: AlertPageMeta;
};

export function AlertList() {
  const [filters, setFilters] = useState<AlertFilters>(EMPTY_ALERT_FILTERS);
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page) });
  if (filters.status) query.set("status", filters.status);
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.kind) query.set("kind", filters.kind);

  const { data: result, error, reload } = useApiData<AlertResponse>(`alerts?${query}`);

  function changeFilters(next: AlertFilters) {
    setPage(1);
    setFilters(next);
  }

  return (
    <AlertListView
      items={error ? null : (result?.data ?? null)}
      meta={result?.meta ?? null}
      failed={Boolean(error)}
      onRetry={reload}
      filters={filters}
      onFiltersChange={changeFilters}
      page={page}
      onPageChange={setPage}
    />
  );
}
