const STORAGE_KEY_V2 = "ga_folders_state_v2";
const STORAGE_KEY_LEGACY = "ga_folders_html_v1";

const normalizeState = (value) => {
  if (!value) {
    return { html: "", folders: [], sort: null, updatedAt: null };
  }

  if (typeof value === "string") {
    return { html: value, folders: [], sort: null, updatedAt: null };
  }

  return {
    html: value.html ?? "",
    folders: Array.isArray(value.folders) ? value.folders : [],
    sort: value.sort ?? null,
    updatedAt: value.updatedAt ?? null,
  };
};

export const saveFoldersState = async (state = {}) => {
  const payload = normalizeState({
    html: state.html ?? "",
    folders: state.folders ?? [],
    sort: state.sort ?? null,
    updatedAt: new Date().toISOString(),
  });

  await chrome.storage.local.set({ [STORAGE_KEY_V2]: payload });
};

export const loadFoldersState = async () => {
  const result = await chrome.storage.local.get([
    STORAGE_KEY_V2,
    STORAGE_KEY_LEGACY,
  ]);

  if (result?.[STORAGE_KEY_V2]) {
    return normalizeState(result[STORAGE_KEY_V2]);
  }

  return normalizeState(result?.[STORAGE_KEY_LEGACY] || "");
};

export const saveFoldersHtml = async (html) => {
  const current = await loadFoldersState();
  await saveFoldersState({ ...current, html: html ?? "" });
};

export const loadFoldersHtml = async () => {
  const state = await loadFoldersState();
  return state.html || "";
};

export const clearFoldersHtml = async () => {
  await chrome.storage.local.remove([STORAGE_KEY_V2, STORAGE_KEY_LEGACY]);
};
