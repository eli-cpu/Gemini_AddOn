// Service worker: runs the AI sorting (so it survives the popup closing)
// and injects the content script into Gemini tabs that were already open
// when the extension was installed/reloaded.
import { requestFolderForPrompt, requestFolderSuggestions } from "./lib/gemini";
import {
  createFolderIn,
  loadApiKey,
  loadSettings,
  loadState,
  removeChatEverywhere,
  saveState,
  sortedKeys,
} from "./lib/storage";
import { CONTENT_SCRIPT_FILE, isGeminiUrl, sendToTab } from "./lib/tabs";

const injectIntoOpenGeminiTabs = async () => {
  const tabs = await chrome.tabs.query({
    url: ["https://gemini.google.com/*", "https://gemini.googleusercontent.com/*"],
  });
  await Promise.all(
    tabs.map((tab) =>
      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT_FILE] })
        .catch(() => {}),
    ),
  );
};

chrome.runtime.onInstalled.addListener(() => {
  injectIntoOpenGeminiTabs();
});

// All AI features need a user-provided key; without one they are hidden in
// the UI, and this is the last line of defence.
const requireApiKey = async () => {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    throw new Error("Kein API-Key gespeichert. Im Popup unter „KI & API-Key“ eintragen.");
  }
  return apiKey;
};

/**
 * Collects chats from the Gemini sidebar, asks Gemini for a grouping and
 * writes the result into the folder state.
 */
export async function aiSort(tabId, { onlyUnsorted = true, maxChats = 100 } = {}) {
  const apiKey = await requireApiKey();
  const tab = await chrome.tabs.get(tabId);
  if (!isGeminiUrl(tab?.url)) {
    throw new Error("Bitte zuerst gemini.google.com im aktiven Tab öffnen.");
  }

  const response = await sendToTab(tabId, { type: "ga:get-chats" });
  const sidebarChats = Array.isArray(response?.chats) ? response.chats : [];

  const [state, settings] = await Promise.all([loadState(), loadSettings()]);
  const alreadySorted = sortedKeys(state);

  // Loose chats in the Folders area are also "unsorted" candidates.
  const candidates = new Map();
  [...state.looseChats, ...sidebarChats].forEach((chat) => {
    if (onlyUnsorted && alreadySorted.has(chat.key)) return;
    if (!candidates.has(chat.key)) candidates.set(chat.key, chat);
  });

  const chats = [...candidates.values()].slice(0, Math.max(1, maxChats));
  if (!chats.length) {
    const message = sidebarChats.length
      ? "Alle geladenen Chats sind bereits in Ordnern."
      : "Keine Chats in der Gemini-Seitenleiste erkannt. Seitenleiste öffnen und Seite neu laden (F5).";
    return { ok: !!sidebarChats.length, moved: 0, created: 0, message, error: message };
  }

  const maxNewFolders = Math.max(0, settings.maxFolders - state.folders.length);
  if (maxNewFolders === 0 && state.folders.length === 0) {
    throw new Error("Maximale Ordneranzahl ist 0.");
  }

  const suggestions = await requestFolderSuggestions(
    chats.map((c) => c.title),
    state.folders.map((f) => f.name),
    maxNewFolders,
    { apiKey },
  );

  // Re-read in case the user changed something while the request was running.
  const fresh = await loadState();
  let moved = 0;
  let created = 0;
  let skipped = 0;
  const assigned = new Set();

  for (const suggestion of suggestions) {
    let folder = fresh.folders.find(
      (f) => f.name.toLowerCase() === suggestion.name.toLowerCase(),
    );
    if (!folder) {
      const result = createFolderIn(fresh, suggestion.name, settings.maxFolders);
      if (!result.ok) {
        skipped += suggestion.chats.length;
        continue;
      }
      folder = result.folder;
      created += 1;
    }

    for (const index of suggestion.chats) {
      const chat = chats[index];
      if (!chat || assigned.has(chat.key)) continue;
      assigned.add(chat.key);
      removeChatEverywhere(fresh, chat.key);
      folder.chats.push({ key: chat.key, title: chat.title, href: chat.href || "" });
      folder.updatedAt = new Date().toISOString();
      moved += 1;
    }
  }

  // AI-created folders that ended up empty are not useful.
  fresh.folders = fresh.folders.filter(
    (f) => f.chats.length || state.folders.some((old) => old.id === f.id),
  );

  await saveState(fresh);
  return {
    ok: true,
    moved,
    created,
    skipped,
    message: `${moved} Chats einsortiert, ${created} neue Ordner.${
      skipped ? ` ${skipped} übersprungen (Ordner-Limit).` : ""
    }`,
  };
}

/** Suggests a folder for the first prompt of a new chat (content script). */
export async function suggestFolder(prompt) {
  const text = String(prompt || "").trim();
  if (!text) throw new Error("Keine Nachricht zum Auswerten.");
  const apiKey = await requireApiKey();
  const [state, settings] = await Promise.all([loadState(), loadSettings()]);
  const names = state.folders.map((f) => f.name);
  const allowNew = state.folders.length < settings.maxFolders;
  const result = await requestFolderForPrompt(text, names, allowNew, { apiKey });
  return { ok: true, ...result };
}

const handlers = {
  "ga:ai-sort": (msg) => aiSort(msg.tabId, msg.options),
  "ga:suggest-folder": (msg) => suggestFolder(msg.prompt),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return undefined;
  handler(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true; // async response
});
