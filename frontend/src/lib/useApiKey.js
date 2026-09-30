import { useEffect, useState } from "react";
import { API_KEY_KEY, loadApiKey } from "./storage";

/**
 * Current API key from chrome.storage.local, kept in sync with changes.
 * Returns { loaded, apiKey, hasKey }.
 */
export function useApiKey() {
  const [state, setState] = useState({ loaded: false, apiKey: "" });

  useEffect(() => {
    let cancelled = false;
    loadApiKey().then((apiKey) => !cancelled && setState({ loaded: true, apiKey }));

    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return () => {
        cancelled = true;
      };
    }
    const onChanged = (changes, area) => {
      if (area !== "local" || !(API_KEY_KEY in changes)) return;
      const value = changes[API_KEY_KEY].newValue;
      setState({ loaded: true, apiKey: typeof value === "string" ? value.trim() : "" });
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return { ...state, hasKey: !!state.apiKey };
}
