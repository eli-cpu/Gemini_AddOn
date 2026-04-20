export const FOLDER_SELECTOR =
  "[data-gemini-folder], [data-folder-id], .gemini-folder, .folder-item-container, .folder-items-container";
export const FOLDER_CONTENT_SELECTOR =
  "[data-gemini-folder-content], .gemini-folder-content, .folder-conversations, .folder-children";
export const FOLDER_DROP_ACTIVE_CLASS = "gemini-folder-drop-active";
export const FOLDER_TITLE_SELECTOR = "[data-gemini-folder-title]";
export const CONVERSATION_LIST_SELECTOR =
  "#conversations-list-0, [id^='conversations-list-']";
export const CHAT_HISTORY_TARGET_SELECTOR =
  "div.chat-history div.chat-history-list conversations-list[data-test-id='all-conversations']";

function createFolderId() {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createFolderElement(name, folderId = createFolderId()) {
  const safeName = (name || "Neuer Ordner").trim();

  const folder = document.createElement("div");
  folder.className = "gemini-folder";
  folder.setAttribute("data-gemini-folder", folderId);
  folder.setAttribute("data-folder-name", safeName);

  const header = document.createElement("div");
  header.className = "gemini-folder-header";
  header.setAttribute("data-gemini-folder-title", "true");
  header.textContent = safeName;

  const content = document.createElement("div");
  content.className = "gemini-folder-content";
  content.setAttribute("data-gemini-folder-content", "true");

  folder.appendChild(header);
  folder.appendChild(content);

  return folder;
}

export function addFolderToList(listContainer, name, folderId) {
  const folder = createFolderElement(name, folderId);
  listContainer.appendChild(folder);
  return folder;
}

export function getFolderName(folderElement) {
  return (
    folderElement.querySelector(FOLDER_TITLE_SELECTOR)?.textContent?.trim() ||
    folderElement.getAttribute("data-folder-name") ||
    "Neuer Ordner"
  );
}

export function getFolderElementFromTarget(target) {
  return target?.closest?.(FOLDER_SELECTOR) ?? null;
}

export function getFolderKey(folderElement, index = 0) {
  const id =
    folderElement.getAttribute("data-gemini-folder") ||
    folderElement.getAttribute("data-folder-id") ||
    folderElement.getAttribute("data-id") ||
    folderElement.id;

  if (id) return `folder:${id}`;

  const title = folderElement.textContent?.trim() || "";
  return `folder-text:${title}::${index}`;
}

export function getFolderContentElement(folderElement) {
  const existing = folderElement.querySelector(FOLDER_CONTENT_SELECTOR);
  if (existing) return existing;

  const content = document.createElement("div");
  content.className = "gemini-folder-content";
  content.setAttribute("data-gemini-folder-content", "true");
  folderElement.appendChild(content);
  return content;
}

export function setFolderDropState(folderElement, isActive) {
  folderElement.classList.toggle(FOLDER_DROP_ACTIVE_CLASS, !!isActive);
}

export function insertConversationIntoFolder(
  conversationElement,
  folderElement,
) {
  const content = getFolderContentElement(folderElement);
  content.appendChild(conversationElement);
}

export function getConversationListElement(root = document) {
  return root?.querySelector?.(CONVERSATION_LIST_SELECTOR) ?? null;
}

export function createFolderInDom(name = "Neuer Ordner", root = document) {
  const listContainer = getConversationListElement(root);
  if (!listContainer) return null;
  return addFolderToList(listContainer, name);
}

export function insertTestDivAboveConversationsList(
  text = "TEST DIV (Gemini AddOn)",
  root = document,
) {
  const target =
    root?.querySelector?.(CHAT_HISTORY_TARGET_SELECTOR) ||
    root?.querySelector?.("conversations-list[data-test-id='all-conversations']");

  if (!target?.parentElement) return null;

  const existing = root.querySelector("[data-gemini-test-div='true']");
  if (existing) existing.remove();

  const testDiv = root.createElement
    ? root.createElement("div")
    : document.createElement("div");

  testDiv.setAttribute("data-gemini-test-div", "true");
  testDiv.className = "gemini-test-div";
  testDiv.textContent = text;

  target.parentElement.insertBefore(testDiv, target);
  return testDiv;
}

export function ensureCreateFolderEventListener() {
  if (typeof window === "undefined" || window.__geminiCreateFolderBound) return;
  window.__geminiCreateFolderBound = true;

  window.addEventListener("gemini-addon:create-folder", (event) => {
    const name = event?.detail?.name || "Neuer Ordner";
    createFolderInDom(name);
  });

  window.addEventListener("gemini-addon:insert-test-div", (event) => {
    const text = event?.detail?.text || "TEST DIV (Gemini AddOn)";
    insertTestDivAboveConversationsList(text);
  });
}

ensureCreateFolderEventListener();
