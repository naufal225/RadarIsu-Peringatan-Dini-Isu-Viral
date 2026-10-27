"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

type ErrorBody = { message?: string; errors?: Record<string, string[]> } | null;

type State<T> = { data: T | null; error: boolean; status: number | null; errorBody: ErrorBody; loading: boolean };

/**
 * Loads `path` through the BFF and exposes `reload()`. State is only set from promise callbacks,
 * and responses for a superseded path are ignored. Pass `null` to skip loading.
 *
 * `loading` is true while a request is in flight (the previous `data` stays visible meanwhile);
 * `status` and `errorBody` describe the last failure (e.g. 403, 404, 422 with field errors).
 */
export function useApiData<T>(path: string | null): {
  data: T | null;
  error: boolean;
  status: number | null;
  errorBody: ErrorBody;
  loading: boolean;
  reload: () => void;
} {
  const [state, setState] = useState<State<T>>({ data: null, error: false, status: null, errorBody: null, loading: path !== null });
  const [version, setVersion] = useState(0);
  const [requested, setRequested] = useState<string | null>(null);

  // A new path or reload starts a request; marking it here (not in the effect) keeps the effect free of sync state updates.
  const key = path === null ? null : `${path}#${version}`;
  if (key !== requested) {
    setRequested(key);
    if (key !== null && !state.loading) setState((s) => ({ ...s, loading: true }));
  }

  useEffect(() => {
    if (path === null) return;
    let current = true;
    api<T>(path)
      .then((data) => current && setState({ data, error: false, status: null, errorBody: null, loading: false }))
      .catch((e: unknown) => {
        if (!current) return;
        const status = e instanceof ApiError ? e.status : null;
        const body = e instanceof ApiError ? e.body : null;
        setState((s) => ({ data: s.data, error: true, status, errorBody: body, loading: false }));
      });
    return () => {
      current = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data: state.data, error: state.error, status: state.status, errorBody: state.errorBody, loading: state.loading, reload };
}
