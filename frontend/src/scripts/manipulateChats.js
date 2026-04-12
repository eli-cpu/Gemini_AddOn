import { CONVERSATION_ITEM_SELECTOR, getConversations } from "./getChats";
import {
  FOLDER_DROP_ACTIVE_CLASS,
  FOLDER_SELECTOR,
  addFolderToList,
  getFolderElementFromTarget,
  getFolderKey,
  getFolderName,
  insertConversationIntoFolder,
  setFolderDropState,
} from "./createFolder";

const STORAGE_KEY = "gemini_chat_custom_order";
const STORAGE_FOLDER_KEY = "gemini_chat_folder_assignments";
const STORAGE_FOLDERS_KEY = "gemini_chat_folders";
const DRAGGING_CLASS = "gemini-addon-dragging";
const CREATE_FOLDER_EVENT = "gemini-addon:create-folder";

function getStorageApi() {
  const hasChromeStorage =
    typeof chrome !== "undefined" && chrome?.storage?.local;

  if (hasChromeStorage) {
    return {
      async get(key) {
        const result = await chrome.storage.local.get(key);
        return result[key];
      },
      async set(key, value) {
        await chrome.storage.local.set({ [key]: value });
      },
    };
  }

  return {
    async get(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        return null;
      }
    },
    async set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

function getConversationKey(element, index) {
  const directId =
    element.getAttribute("data-conversation-id") ||
    element.getAttribute("data-id");

  if (directId) return `id:${directId}`;

  const link = element.querySelector("a[href]");
  if (link?.getAttribute("href")) return `href:${link.getAttribute("href")}`;

  const title = element.textContent?.trim() || "";
  return `text:${title}::${index}`;
}

function isConversationItem(el) {
  return !!el?.matches?.(CONVERSATION_ITEM_SELECTOR);
}

function getTopLevelConversationItems(listContainer) {
  return Array.from(listContainer.children).filter(isConversationItem);
}

function getAllConversationItems(listContainer) {
  return [...listContainer.querySelectorAll(CONVERSATION_ITEM_SELECTOR)];
}

function getTopLevelFolders(listContainer) {
  return Array.from(listContainer.children).filter((el) =>
    el.matches?.(FOLDER_SELECTOR),
  );
}

function ensureFolderCreateButton(listContainer, onCreate) {
  if (document.getElementById("gemini-addon-create-folder-btn")) return;

  const button = document.createElement("button");
  button.id = "gemini-addon-create-folder-btn";
  button.type = "button";
  button.textContent = "+ Neuer Ordner";
  button.addEventListener("click", onCreate);

  (listContainer.parentElement || listContainer).insertBefore(
    button,
    listContainer,
  );
}

function ensureDraggableStyles() {
  if (document.getElementById("gemini-addon-dnd-style")) return;

  const style = document.createElement("style");
  style.id = "gemini-addon-dnd-style";
  style.textContent = `
    .conversation-items-container,
    .conversations-items-container {
      cursor: grab;
    }
    .${DRAGGING_CLASS} {
      opacity: 0.45 !important;
    }
    .${FOLDER_DROP_ACTIVE_CLASS} {
      outline: 2px dashed #6b8cff !important;
      outline-offset: 2px;
      border-radius: 8px;
    }
    #gemini-addon-create-folder-btn {
      margin: 0 0 8px 0;
      padding: 6px 10px;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      font-size: 12px;
    }
    .gemini-folder {
      margin: 6px 0;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      padding: 6px;
    }
    .gemini-folder-header {
      font-weight: 600;
      margin-bottom: 4px;
    }
  `;
  document.head.appendChild(style);
}

function getDragAfterElement(container, mouseY) {
  const items = Array.from(container.children).filter(
    (el) => isConversationItem(el) && !el.classList.contains(DRAGGING_CLASS),
  );

  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  for (const child of items) {
    const rect = child.getBoundingClientRect();
    const offset = mouseY - rect.top - rect.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  }

  return closest.element;
}

async function saveCurrentStructure(listContainer) {
  const storage = getStorageApi();

  const allItems = getAllConversationItems(listContainer);
  const keyByElement = new Map(
    allItems.map((item, idx) => [item, getConversationKey(item, idx)]),
  );

  const order = getTopLevelConversationItems(listContainer)
    .map((item) => keyByElement.get(item))
    .filter(Boolean);

  const folders = getTopLevelFolders(listContainer);
  const savedFolders = folders.map((folder) => ({
    id: folder.getAttribute("data-gemini-folder") || "",
    name: getFolderName(folder),
  }));

  const folderAssignments = {};
  const allFolders = [...listContainer.querySelectorAll(FOLDER_SELECTOR)];
  allFolders.forEach((folder, folderIndex) => {
    const folderKey = getFolderKey(folder, folderIndex);
    folder.querySelectorAll(CONVERSATION_ITEM_SELECTOR).forEach((chat) => {
      const chatKey = keyByElement.get(chat);
      if (chatKey) folderAssignments[chatKey] = folderKey;
    });
  });

  await storage.set(STORAGE_KEY, order);
  await storage.set(STORAGE_FOLDER_KEY, folderAssignments);
  await storage.set(STORAGE_FOLDERS_KEY, savedFolders);
}

async function applySavedOrder(listContainer) {
  const storage = getStorageApi();
  const savedOrder = await storage.get(STORAGE_KEY);
  const folderAssignments = await storage.get(STORAGE_FOLDER_KEY);
  const savedFolders = await storage.get(STORAGE_FOLDERS_KEY);

  if (Array.isArray(savedFolders)) {
    savedFolders.forEach((folder) => {
      const exists = [...listContainer.querySelectorAll(FOLDER_SELECTOR)].some(
        (el) => (el.getAttribute("data-gemini-folder") || "") === folder.id,
      );
      if (!exists) addFolderToList(listContainer, folder.name, folder.id);
    });
  }

  const allItems = getAllConversationItems(listContainer);
  if (!allItems.length) return;

  const keyed = allItems.map((el, idx) => ({
    el,
    key: getConversationKey(el, idx),
  }));
  const chatByKey = new Map(keyed.map((k) => [k.key, k.el]));

  if (folderAssignments && typeof folderAssignments === "object") {
    const folders = [...listContainer.querySelectorAll(FOLDER_SELECTOR)];
    const folderByKey = new Map(
      folders.map((folder, folderIndex) => [
        getFolderKey(folder, folderIndex),
        folder,
      ]),
    );

    Object.entries(folderAssignments).forEach(([chatKey, folderKey]) => {
      const chatEl = chatByKey.get(chatKey);
      const folderEl = folderByKey.get(folderKey);
      if (chatEl && folderEl) insertConversationIntoFolder(chatEl, folderEl);
    });
  }

  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return;

  const topLevel = getTopLevelConversationItems(listContainer);
  const topLevelKeyed = topLevel.map((el, idx) => ({
    el,
    key: getConversationKey(el, idx),
  }));
  const topLevelMap = new Map(topLevelKeyed.map((k) => [k.key, k.el]));

  for (const key of savedOrder) {
    const el = topLevelMap.get(key);
    if (el) listContainer.appendChild(el);
  }

  for (const { el, key } of topLevelKeyed) {
    if (!savedOrder.includes(key)) listContainer.appendChild(el);
  }
}

function bindDnD(listContainer) {
  let draggingElement = null;
  let activeFolderElement = null;

  const clearFolderHighlight = () => {
    if (activeFolderElement) {
      setFolderDropState(activeFolderElement, false);
      activeFolderElement = null;
    }
  };

  const markItems = () => {
    const items = listContainer.querySelectorAll(CONVERSATION_ITEM_SELECTOR);
    items.forEach((item) => {
      if (item.getAttribute("draggable") !== "true") {
        item.setAttribute("draggable", "true");
      }
    });
  };

  listContainer.addEventListener("dragstart", (event) => {
    const target = event.target?.closest?.(CONVERSATION_ITEM_SELECTOR);
    if (!target) return;

    draggingElement = target;
    target.classList.add(DRAGGING_CLASS);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "drag-chat");
  });

  listContainer.addEventListener("dragover", (event) => {
    if (!draggingElement) return;

    const hoveredFolder = getFolderElementFromTarget(event.target);
    if (
      hoveredFolder &&
      hoveredFolder !== draggingElement &&
      !hoveredFolder.contains(draggingElement)
    ) {
      event.preventDefault();
      if (activeFolderElement !== hoveredFolder) {
        clearFolderHighlight();
        activeFolderElement = hoveredFolder;
        setFolderDropState(activeFolderElement, true);
      }
      return;
    }

    clearFolderHighlight();
    event.preventDefault();

    const afterElement = getDragAfterElement(listContainer, event.clientY);
    if (!afterElement) {
      listContainer.appendChild(draggingElement);
    } else if (afterElement !== draggingElement) {
      listContainer.insertBefore(draggingElement, afterElement);
    }
  });

  listContainer.addEventListener("drop", async (event) => {
    if (!draggingElement) return;
    event.preventDefault();

    if (activeFolderElement) {
      insertConversationIntoFolder(draggingElement, activeFolderElement);
      clearFolderHighlight();
      await saveCurrentStructure(listContainer);
      return;
    }

    await saveCurrentStructure(listContainer);
  });

  listContainer.addEventListener("dragend", async () => {
    if (!draggingElement) return;
    draggingElement.classList.remove(DRAGGING_CLASS);
    draggingElement = null;
    clearFolderHighlight();
    await saveCurrentStructure(listContainer);
  });

  markItems();

  const observer = new MutationObserver(() => {
    markItems();
  });
  observer.observe(listContainer, { childList: true, subtree: true });

  return () => observer.disconnect();
}

export async function initGeminiChatDragAndDrop() {
  ensureDraggableStyles();

  const conversations = getConversations(document);
  if (!conversations.length) return () => {};

  const listContainer = conversations[0].element.parentElement;
  if (!listContainer) return () => {};

  const createFolderFromPrompt = async () => {
    const name = prompt("Ordnername eingeben:");
    if (!name?.trim()) return;
    addFolderToList(listContainer, name.trim());
    await saveCurrentStructure(listContainer);
  };

  ensureFolderCreateButton(listContainer, () => {
    void createFolderFromPrompt();
  });

  const onCreateFolderEvent = () => {
    void createFolderFromPrompt();
  };
  window.addEventListener(CREATE_FOLDER_EVENT, onCreateFolderEvent);

  await applySavedOrder(listContainer);
  const cleanupDnD = bindDnD(listContainer);

  return () => {
    cleanupDnD();
    window.removeEventListener(CREATE_FOLDER_EVENT, onCreateFolderEvent);
  };
}
