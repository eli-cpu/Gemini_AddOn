export async function executeInActiveTab(func) {
  if (
    typeof chrome === "undefined" ||
    !chrome.tabs?.query ||
    !chrome.scripting?.executeScript
  ) {
    throw new Error("Chrome Extension APIs nicht verfügbar.");
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    throw new Error("Kein aktiver Tab gefunden.");
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func,
  });

  return result;
}
