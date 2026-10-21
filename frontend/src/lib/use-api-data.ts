"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Loads `path` through the BFF and exposes `reload()`. State is only set from promise callbacks,
 * and responses for a superseded path are ignored. Pass `null` to skip loading.
 */
export function useApiData<T>(path: string | null): { data: T | null; error: boolean; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let current = true;
    api<T>(path)
      .then((data) => current && setState({ data, error: false }))
      .catch(() => current && setState((s) => ({ data: s.data, error: true })));
    return () => {
      current = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data: state.data, error: state.error, reload };
}
