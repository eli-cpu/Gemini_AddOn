export function injectFolderSpaceSeparator(doc = document) {
  const gemsContainer = doc.querySelector(".gems-list-container");
  const existing = doc.getElementById("my-folder-separator");

  if (!gemsContainer) return "missing-container";
  if (existing) return "exists";

  const myDiv = doc.createElement("div");
  myDiv.id = "my-folder-separator";
  myDiv.style.cssText = `
      padding: 15px;
      margin: 10px 0;
      text-align: center;
      border: 1px dashed #555;
      color: #e0e0e0;
      font-size: 14px;
      border-radius: 8px;
      background: #2a2a2e;
    `;
  myDiv.innerText = "Folder";
  gemsContainer.after(myDiv);
  return "inserted";
}

export function startInjectionObserver(doc = document) {
  const observer = new MutationObserver(() => injectFolderSpaceSeparator(doc));
  observer.observe(doc.body, { childList: true, subtree: true });
  injectFolderSpaceSeparator(doc);
  return observer;
}

export function removeFolderSpaceSeparator(doc = document) {
  const existing = doc.getElementById("my-folder-separator");
  if (!existing) return "missing-separator";
  existing.remove();
  return "removed";
}

export function setFolderSpaceSeparatorState(enabled, doc = document) {
  return enabled
    ? injectFolderSpaceSeparator(doc)
    : removeFolderSpaceSeparator(doc);
}

export function createFolderSpace(doc = document, options = {}) {
  const { enabled, toggle = true } = options;
  if (typeof enabled === "boolean")
    return setFolderSpaceSeparatorState(enabled, doc);

  if (!toggle) return injectFolderSpaceSeparator(doc);

  const existing = doc.getElementById("my-folder-separator");
  return existing
    ? removeFolderSpaceSeparator(doc)
    : injectFolderSpaceSeparator(doc);
}
