// Helpers for talking to the content script in a Gemini/ChatGPT tab.
import { siteForUrl } from "./sites";

export const CONTENT_SCRIPT_FILE = "autoFolderInit.js";

export const hasExtensionApis = () =>
  typeof chrome !== "undefined" &&
  !!chrome.tabs?.query &&
  !!chrome.scripting?.executeScript;

const NOT_SUPPORTED = "Bitte zuerst Gemini oder ChatGPT im aktiven Tab öffnen.";

/** Active tab plus its site id. Throws if it's not a supported chat site. */
export async function getActiveChatTab() {
  if (!hasExtensionApis()) {
    throw new Error("Chrome Extension APIs nicht verfügbar.");
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Kein aktiver Tab gefunden.");
  const site = siteForUrl(tab.url);
  if (!site) throw new Error(NOT_SUPPORTED);
  return { tab, site };
}

/**
 * Makes sure the content script is running in the tab. Tabs that were open
 * before the extension was (re)loaded don't have it yet, so inject it.
 */
export async function ensureContentScript(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "ga:ping" });
    if (res?.ok) return;
  } catch {
    // no receiver yet -> inject below
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  });
}

export async function sendToTab(tabId, message) {
  await ensureContentScript(tabId);
  // The freshly injected script needs a moment to register its listener.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      if (attempt === 9) throw err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return undefined;
}
