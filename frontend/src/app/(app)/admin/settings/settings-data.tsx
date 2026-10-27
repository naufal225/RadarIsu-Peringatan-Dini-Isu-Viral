"use client";

import { useState } from "react";
import { SettingsView } from "@/components/settings/settings-view";
import { api, ApiError } from "@/lib/api";
import type { DetectionSettings, OfflineModeResponse, SettingsResponse } from "@/lib/api-types/settings";
import { setPath } from "@/lib/detection-settings";
import { invalidFields } from "@/lib/format";
import { useApiData } from "@/lib/use-api-data";

/** Pengambil data /admin/settings: draf disalin dari respons terakhir dan diganti setiap kali respons berubah. */
export function SettingsData() {
  const detection = useApiData<SettingsResponse>("settings/detection");
  const offline = useApiData<OfflineModeResponse>("settings/offline-mode");

  const loaded = detection.data?.data ?? null;
  const [draftFor, setDraftFor] = useState<SettingsResponse["data"] | null>(null);
  const [draft, setDraft] = useState<DetectionSettings | null>(null);
  // A new response (first load or after a save) replaces the draft; done during render, not in an effect.
  if (loaded && loaded !== draftFor) {
    setDraftFor(loaded);
    setDraft(loaded.value);
  }

  const [serverFields, setServerFields] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const offlineLoaded = offline.data?.data ?? null;
  const [offlineFor, setOfflineFor] = useState<OfflineModeResponse["data"] | null>(null);
  const [enabled, setEnabled] = useState(false);
  if (offlineLoaded && offlineLoaded !== offlineFor) {
    setOfflineFor(offlineLoaded);
    setEnabled(offlineLoaded.value.enabled);
  }
  const [offlinePending, setOfflinePending] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [offlineFailed, setOfflineFailed] = useState(false);

  async function save() {
    if (!draft) return;
    setPending(true);
    setSaveFailed(false);
    setServerFields([]);
    setSaved(false);
    try {
      await api("settings/detection", { method: "PUT", body: JSON.stringify(draft) });
      setSaved(true);
      detection.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setServerFields(invalidFields(e.body));
      else setSaveFailed(true);
    } finally {
      setPending(false);
    }
  }

  async function saveOffline() {
    setOfflinePending(true);
    setOfflineFailed(false);
    setOfflineSaved(false);
    try {
      await api("settings/offline-mode", { method: "PUT", body: JSON.stringify({ enabled }) });
      setOfflineSaved(true);
      offline.reload();
    } catch {
      setOfflineFailed(true);
    } finally {
      setOfflinePending(false);
    }
  }

  return (
    <SettingsView
      loaded={loaded}
      loading={detection.loading}
      failed={detection.error && loaded === null}
      onRetry={detection.reload}
      draft={draft}
      onChange={(path, raw) => {
        setDraft((current) => (current ? setPath(current, path, raw === "" ? Number.NaN : Number(raw)) : current));
        setServerFields([]);
        setSaved(false);
      }}
      serverFields={serverFields}
      pending={pending}
      saveFailed={saveFailed}
      saved={saved}
      onSubmit={save}
      onReset={() => loaded && setDraft(loaded.value)}
      offline={{
        loaded: offlineLoaded,
        enabled,
        onToggle: (value) => {
          setEnabled(value);
          setOfflineSaved(false);
        },
        onSave: saveOffline,
        pending: offlinePending,
        saved: offlineSaved,
        failed: offlineFailed || (offline.error && offlineLoaded === null),
      }}
    />
  );
}
