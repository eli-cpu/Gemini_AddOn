// Shared storage layer for popup + background.
// Keep keys and the state shape in sync with public/autoFolderInit.js
// (the content script cannot import modules).

import { deleteSecret, getSecret, hasSecretStore, setSecret } from "./secretStore";

export const STATE_KEY = "ga_folders_state_v3";
export const SETTINGS_KEY = "ga_settings_v1";
// Boolean flag in chrome.storage.local: "an API key is saved". This is all
// the content script ever sees – the key itself lives in the extension-only
// secret store (lib/secretStore.js).
export const AI_FLAG_KEY = "ga_ai_enabled_v1";
const API_KEY_SECRET = "geminiApiKey";
// Old location of the key (readable by content scripts) – migrated away.
const LEGACY_API_KEY_KEY = "ga_api_key_v1";

export const DEFAULT_SETTINGS = { maxFolders: 10, autoDeleteDays: 0 };

const uid = () =>
  `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const cleanText = (text) => (text || "").replace(/\s+/g, " ").trim();

export const emptyState = () => ({
  version: 3,
  collapsed: false,
  folders: [],
  looseChats: [],
});

const normalizeChat = (chat) => {
  if (!chat || typeof chat !== "object" || !chat.key) return null;
  return {
    key: String(chat.key),
    title: String(chat.title || "Unbenannter Chat"),
    href: chat.href ? String(chat.href) : "",
  };
};

export const normalizeState = (raw) => {
  if (!raw || typeof raw !== "object") return emptyState();
  const now = new Date().toISOString();
  const seen = new Set();
  const uniqueChats = (list) =>
    (Array.isArray(list) ? list : [])
      .map(normalizeChat)
      .filter((c) => c && !seen.has(c.key) && seen.add(c.key));

  return {
    version: 3,
    collapsed: !!raw.collapsed,
    folders: (Array.isArray(raw.folders) ? raw.folders : [])
      .filter((f) => f && typeof f === "object")
      .map((f) => ({
        id: String(f.id || uid()),
        name: String(f.name || "Neuer Folder"),
        expanded: !!f.expanded,
        createdAt: f.createdAt || now,
        updatedAt: f.updatedAt || f.createdAt || now,
        chats: uniqueChats(f.chats),
      })),
    looseChats: uniqueChats(raw.looseChats),
  };
};

export const normalizeSettings = (raw) => {
  const s = {
    ...DEFAULT_SETTINGS,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
  return {
    maxFolders: Math.max(
      1,
      Math.min(100, parseInt(s.maxFolders, 10) || DEFAULT_SETTINGS.maxFolders),
    ),
    autoDeleteDays: Math.max(0, parseInt(s.autoDeleteDays, 10) || 0),
  };
};

const hasChrome = () =>
  typeof chrome !== "undefined" && !!chrome.storage?.local;

export async function loadState() {
  if (!hasChrome()) return emptyState();
  const result = await chrome.storage.local.get(STATE_KEY);
  return normalizeState(result[STATE_KEY]);
}

export async function saveState(state) {
  const payload = {
    ...normalizeState(state),
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STATE_KEY]: payload });
  return payload;
}

export async function loadSettings() {
  if (!hasChrome()) return { ...DEFAULT_SETTINGS };
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

// --- API key (extension pages + service worker only) -----------------------

/** Moves a key saved by older versions out of chrome.storage.local. */
export async function migrateLegacyApiKey() {
  if (!hasChrome() || !hasSecretStore()) return;
  const result = await chrome.storage.local.get([LEGACY_API_KEY_KEY, AI_FLAG_KEY]);
  const legacy = result[LEGACY_API_KEY_KEY];
  if (typeof legacy === "string" && legacy.trim()) {
    if (!(await getSecret(API_KEY_SECRET))) await setSecret(API_KEY_SECRET, legacy.trim());
  }
  if (LEGACY_API_KEY_KEY in result) await chrome.storage.local.remove(LEGACY_API_KEY_KEY);
  // Keep the flag consistent with the secret store.
  const hasKey = !!(await getSecret(API_KEY_SECRET));
  if (result[AI_FLAG_KEY] !== hasKey) await chrome.storage.local.set({ [AI_FLAG_KEY]: hasKey });
}

export async function loadApiKey() {
  if (!hasChrome() || !hasSecretStore()) return "";
  await migrateLegacyApiKey();
  const value = await getSecret(API_KEY_SECRET);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveApiKey(key) {
  const value = String(key || "").trim();
  if (!value) throw new Error("Kein API-Key angegeben.");
  await setSecret(API_KEY_SECRET, value);
  await chrome.storage.local.set({ [AI_FLAG_KEY]: true });
}

export async function removeApiKey() {
  await deleteSecret(API_KEY_SECRET);
  await chrome.storage.local.set({ [AI_FLAG_KEY]: false });
}

/** "AIza…Wx4k" – enough to recognise the key without showing it. */
export const maskApiKey = (key) =>
  key ? `${key.slice(0, 4)}…${key.slice(-4)}` : "";

/** Reads, mutates and writes the state in one go. */
export async function updateState(mutator) {
  const state = await loadState();
  const result = await mutator(state);
  await saveState(state);
  return result;
}

export function createFolderIn(state, name, maxFolders) {
  if (state.folders.length >= maxFolders) {
    return { ok: false, reason: "max-folders" };
  }
  const now = new Date().toISOString();
  const folder = {
    id: uid(),
    name: cleanText(name) || "Neuer Folder",
    expanded: false,
    createdAt: now,
    updatedAt: now,
    chats: [],
  };
  state.folders.unshift(folder);
  return { ok: true, folder };
}

export function removeChatEverywhere(state, key) {
  state.looseChats = state.looseChats.filter((c) => c.key !== key);
  state.folders.forEach((f) => {
    const before = f.chats.length;
    f.chats = f.chats.filter((c) => c.key !== key);
    if (before !== f.chats.length) f.updatedAt = new Date().toISOString();
  });
}

export function sortedKeys(state) {
  const keys = new Set();
  state.folders.forEach((f) => f.chats.forEach((c) => keys.add(c.key)));
  return keys;
}
