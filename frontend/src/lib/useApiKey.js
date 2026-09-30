import { useEffect, useState } from "react";
import { AI_FLAG_KEY, loadApiKey } from "./storage";

/**
 * Current API key (from the extension-only secret store), reloaded whenever
 * the "AI enabled" flag in chrome.storage.local changes.
 * Returns { loaded, apiKey, hasKey }.
 */
export function useApiKey() {
  const [state, setState] = useState({ loaded: false, apiKey: "" });

  useEffect(() => {
    let cancelled = false;
    const reload = () =>
      loadApiKey()
        .catch(() => "")
        .then((apiKey) => !cancelled && setState({ loaded: true, apiKey }));
    reload();

    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return () => {
        cancelled = true;
      };
    }
    const onChanged = (changes, area) => {
      if (area === "local" && AI_FLAG_KEY in changes) reload();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return { ...state, hasKey: !!state.apiKey };
}
