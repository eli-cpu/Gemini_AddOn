const STORAGE_KEY = "ga_folders_html_v1";

export const saveFoldersHtml = async (html) => {
  await chrome.storage.local.set({ [STORAGE_KEY]: html ?? "" });
};

export const loadFoldersHtml = async () => {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result?.[STORAGE_KEY] || "";
};

export const clearFoldersHtml = async () => {
  await chrome.storage.local.remove([STORAGE_KEY]);
};
