export const FOLDER_SELECTOR =
  "[data-gemini-folder], [data-folder-id], .gemini-folder, .folder-item-container, .folder-items-container";
export const FOLDER_CONTENT_SELECTOR =
  "[data-gemini-folder-content], .gemini-folder-content, .folder-conversations, .folder-children";
export const FOLDER_DROP_ACTIVE_CLASS = "gemini-folder-drop-active";
export const FOLDER_TITLE_SELECTOR = "[data-gemini-folder-title]";

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
