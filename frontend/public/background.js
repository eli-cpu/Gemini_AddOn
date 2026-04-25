const DROP_ZONE_ID = "gemini-folder-drop-zone";

const isGeminiUrl = (url = "") =>
  url.startsWith("https://gemini.google.com/") ||
  url.startsWith("https://gemini.googleusercontent.com/");

const ensureFolderArea = () => {
  const anchor = document.querySelector(".gems-list-container");
  if (!anchor) return "missing-anchor";

  let dropZone = document.getElementById(DROP_ZONE_ID);
  if (dropZone) return "exists";

  dropZone = document.createElement("div");
  dropZone.id = DROP_ZONE_ID;
  dropZone.style.cssText = `
    min-height: 120px;
    margin: 12px 0;
    padding: 8px;
    border: 1px dashed #555;
    border-radius: 10px;
    background: #2a2a2e;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  const heading = document.createElement("div");
  heading.className = "ga-folder-heading";
  heading.style.cssText = `
    margin: 0 0 4px 2px;
    font-size: 13px;
    font-weight: 600;
    color: #e0e0e0;
  `;
  heading.textContent = "Folders";
  dropZone.appendChild(heading);

  anchor.after(dropZone);
  return "inserted";
};

const injectFolderArea = async (tabId, url) => {
  if (!tabId || !isGeminiUrl(url)) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: ensureFolderArea,
    });
  } catch {
    // intentionally ignored
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  injectFolderArea(tabId, tab?.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    injectFolderArea(tabId, tab?.url);
  } catch {
    // intentionally ignored
  }
});
