/*
 * Gemini AddOn – Content Script
 *
 * Owns everything that happens inside the Gemini page:
 *  - mounts the "Folders" section inside the sidebar (never elsewhere)
 *  - renders folders + chats from a JSON state in chrome.storage.local
 *  - drag & drop of chats into the section / into folders
 *  - hides foldered chats in the sidebar list (but not in search results)
 *  - folder picker above the prompt input of a new chat (manual or AI)
 *  - keeps itself in sync when the popup/background change the storage
 */
(() => {
  // Guard against double injection. After an extension reload the old
  // instance loses its runtime context; then it is torn down and replaced.
  const previous = window.__gaFolderAddon;
  if (previous?.isAlive?.()) return;
  previous?.teardown?.();

  const cleanups = [];
  const selfAlive = () => {
    try {
      return typeof chrome !== "undefined" && !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  window.__gaFolderAddon = {
    isAlive: selfAlive,
    teardown: () =>
      cleanups.splice(0).forEach((fn) => {
        try {
          fn();
        } catch {
          // ignore
        }
      }),
  };

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const LOG = "[Gemini AddOn]";
  const ZONE_ID = "gemini-folder-drop-zone";
  const PICKER_ID = "ga-new-chat-folder-picker";
  const TOAST_ID = "ga-toast";
  const STYLE_ID = "gemini-folder-addon-style";
  const SETTINGS_KEY = "ga_settings_v1";
  // Boolean flag "an API key is saved". The key itself is kept in the
  // extension-only secret store and never reaches this script.
  const AI_FLAG_KEY = "ga_ai_enabled_v1";
  const DRAG_MIME = "application/x-ga-chat";
  // Hidden sidebar rows get an attribute instead of a class: React/Angular
  // rewrite `className` on re-render, but leave unknown attributes alone.
  const HIDDEN_ATTR = "data-ga-hidden";
  const DEFAULT_SETTINGS = { maxFolders: 10, autoDeleteDays: 0 };

  // ---------------------------------------------------------------------------
  // Per-site DOM configuration. Both UIs change regularly – keep every
  // site-specific selector in here and add fallbacks instead of replacing.
  // Keep keys/ids in sync with src/lib/sites.js.
  // ---------------------------------------------------------------------------
  const SITES = {
    gemini: {
      id: "gemini",
      label: "Gemini",
      hosts: ["gemini.google.com", "gemini.googleusercontent.com"],
      stateKey: "ga_folders_state_v3",
      legacyKeys: ["ga_folders_state_v2", "ga_folders_html_v1"],
      // Chat links: /app/<id>, also /u/<n>/app/<id> for secondary accounts.
      linkSelector: 'a[href*="/app/"]',
      chatPathRe: /^(?:\/u\/\d+)?\/app\/([\w-]{6,})/,
      chatHref: (id) => `/app/${id}`,
      itemSelector:
        '.conversation-items-container, .conversations-items-container, [data-test-id="conversation"]',
      // Wrappers from older Gemini versions that have no /app/ link.
      legacyItemSelector: ".conversation-items-container, .conversations-items-container",
      titleSelector: ".conversation-title, [class*='title']",
      sidebarSelectors: [
        "bard-sidenav",
        "mat-sidenav",
        ".sidenav-with-history-container",
        "side-navigation-v2",
      ],
      sidebarMarker: "conversations-list, .gems-list-container",
      mountPoints: [
        { selector: ".gems-list-container", where: "after" },
        { selector: "conversations-list", where: "before" },
      ],
      listSelector:
        "conversations-list, infinite-scroller, [class*='conversations-container'], [class*='chat-history'], ul, ol",
      mainSelector: 'main, chat-window, [role="main"], search-page, .search-page',
      newChatPathRe: /^(\/u\/\d+)?\/app\/?$/,
      editorSelector: 'rich-textarea [contenteditable="true"], .ql-editor[contenteditable="true"]',
      composerSelector: "input-area-v2, input-container, .input-area, form",
      // Folder chip goes before the first one found (Flash/Pro, then mic).
      toolbarAnchors: [
        "bard-mode-switcher",
        "[data-test-id='bard-mode-menu-button']",
        "speech-dictation-mic-button",
        "button[aria-label*='Mikrofon' i]",
        "button[aria-label*='microphone' i]",
        "button[aria-label*='Spracheingabe' i]",
      ],
      sendSelector:
        'button.send-button, button[aria-label*="Send" i], button[aria-label*="Senden" i], [data-test-id="send-button"]',
    },
    chatgpt: {
      id: "chatgpt",
      label: "ChatGPT",
      hosts: ["chatgpt.com"],
      stateKey: "ga_folders_state_v3_chatgpt",
      legacyKeys: [],
      // Chat links: /c/<id>, also inside GPTs/projects: /g/<gpt>/c/<id>.
      linkSelector: 'a[href*="/c/"]',
      chatPathRe: /^(?:\/g\/[\w-]+)?\/c\/([\w-]{8,})/,
      chatHref: (id) => `/c/${id}`,
      itemSelector: 'li[data-testid^="history-item"], a[data-sidebar-item]',
      legacyItemSelector: null,
      titleSelector: ".truncate, [dir='auto']",
      sidebarSelectors: [
        "#stage-slideover-sidebar",
        "nav:has(#history)",
        "nav[aria-label]",
      ],
      sidebarMarker: "#history",
      mountPoints: [{ selector: "#history", where: "before" }],
      listSelector: "#history, aside, ul, ol",
      mainSelector: 'main, [role="main"], #thread, [role="dialog"]',
      // New chat: "/", a GPT start page "/g/<gpt>" or a project "/g/<p>/project".
      newChatPathRe: /^\/(?:g\/[\w-]+(?:\/project)?\/?)?$/,
      editorSelector:
        '#prompt-textarea, [data-testid="prompt-textarea"], form [contenteditable="true"][role="textbox"], form textarea[name="prompt-textarea"]',
      composerSelector: "form",
      toolbarAnchors: [
        "[data-testid='composer-speech-button']",
        "button[aria-label*='Dictate' i]",
        "button[aria-label*='Diktier' i]",
        "#composer-submit-button",
        "[data-testid='send-button']",
        "form button[type='submit']",
      ],
      sendSelector:
        '#composer-submit-button, [data-testid="send-button"], form button[type="submit"]',
    },
  };

  const SITE =
    Object.values(SITES).find((s) => s.hosts.includes(window.location.hostname)) || null;
  if (!SITE) return; // not a supported chat site

  const STATE_KEY = SITE.stateKey;
  const LEGACY_KEYS = SITE.legacyKeys;
  const SIDEBAR_ROOT_SELECTOR = SITE.sidebarSelectors.join(", ");
  const RECENT_HEADING_RE =
    /^(letzte unterhaltungen|recent|recent chats|chats|verlauf|chatverlauf|your chats|deine chats)$/i;

  // Folder picker option values
  const AUTO = "__auto__";
  const NEW_PREFIX = "__new__:";

  const ICONS = {
    chevron:
      "M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41.01z",
    folder:
      "M9.17 6l2 2H20v10H4V6h5.17M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
    folderOpen:
      "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
    chat: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z",
    add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    delete:
      "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM8 9h8v10H8V9zm7.5-5-1-1h-5l-1 1H5v2h14V4z",
    close:
      "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    sparkle: "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z",
    check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    expand: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  };

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------
  const hasStorage = () => selfAlive() && !!chrome.storage?.local;

  const storageGet = (keys) =>
    new Promise((resolve) => {
      try {
        if (!hasStorage()) return resolve({});
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      } catch (err) {
        console.warn(LOG, "storage.get failed:", err?.message);
        resolve({});
      }
    });

  const storageSet = (data) =>
    new Promise((resolve) => {
      try {
        if (!hasStorage()) {
          shutdownIfOrphaned();
          return resolve(false);
        }
        chrome.storage.local.set(data, () => {
          const error = chrome.runtime?.lastError;
          if (error) console.warn(LOG, "storage.set:", error.message);
          resolve(!error);
        });
      } catch (err) {
        console.warn(LOG, "storage.set failed:", err?.message);
        shutdownIfOrphaned();
        resolve(false);
      }
    });

  const sendToBackground = async (message) => {
    try {
      if (!selfAlive()) throw new Error("Extension wurde neu geladen – bitte Seite neu laden (F5).");
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  };

  const shutdownIfOrphaned = () => {
    if (selfAlive()) return false;
    console.info(LOG, "Extension wurde neu geladen – alte Instanz beendet.");
    window.__gaFolderAddon?.teardown?.();
    return true;
  };

  const uid = () =>
    `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const cleanText = (text) => (text || "").replace(/\s+/g, " ").trim();

  const emptyState = () => ({ version: 3, collapsed: false, folders: [], looseChats: [] });

  const normalizeChat = (chat) => {
    if (!chat || typeof chat !== "object" || !chat.key) return null;
    return {
      key: String(chat.key),
      title: String(chat.title || "Unbenannter Chat"),
      // Only same-origin chat paths – drag data and storage are untrusted
      // input, and the href ends up in <a href> / location.assign().
      href: safeChatHref(chat.href),
    };
  };

  // Keep in sync with src/lib/storage.js
  const normalizeState = (raw) => {
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

  const normalizeSettings = (raw) => {
    const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
    return {
      maxFolders: Math.max(1, Math.min(100, parseInt(s.maxFolders, 10) || DEFAULT_SETTINGS.maxFolders)),
      autoDeleteDays: Math.max(0, parseInt(s.autoDeleteDays, 10) || 0),
    };
  };

  // ---------------------------------------------------------------------------
  // Runtime state
  // ---------------------------------------------------------------------------
  let state = emptyState();
  let settings = { ...DEFAULT_SETTINGS };
  // Snapshots of our own writes, to ignore their storage.onChanged echo.
  let pendingSaves = [];
  let activeKey = null;
  let dropZone = null;
  let editing = null; // { type: "new" } | { type: "rename", id }
  let aiEnabled = false; // true only while an API key is saved
  const isAiFlagOn = (value) => value === true;
  let pendingFocus = null;

  const saveState = async () => {
    pendingSaves.push(JSON.stringify(state));
    if (pendingSaves.length > 50) pendingSaves = pendingSaves.slice(-50);
    await storageSet({ [STATE_KEY]: { ...state, updatedAt: new Date().toISOString() } });
  };

  const commit = async () => {
    render();
    syncNativeItems();
    await saveState();
  };

  // ---------------------------------------------------------------------------
  // Gemini DOM: sidebar + chat items
  // ---------------------------------------------------------------------------
  const inZone = (node) => !!dropZone && !!node && dropZone.contains(node);

  // Selector helpers that never throw (e.g. `:has()` in older engines).
  const safeAll = (root, selector) => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };
  const safeMatches = (node, selector) => {
    try {
      return node.matches(selector);
    } catch {
      return false;
    }
  };

  // Chat id from a link/URL – only same-origin chat paths count, so links to
  // other sites inside chat answers (e.g. https://example.com/c/…) are ignored.
  const chatIdFromHref = (href) => {
    if (!href) return "";
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return "";
      return url.pathname.match(SITE.chatPathRe)?.[1] || "";
    } catch {
      return "";
    }
  };

  // Same-origin path of a chat link, or "" (never javascript:/foreign URLs).
  const safeChatHref = (href) => {
    if (!href || !chatIdFromHref(String(href))) return "";
    const url = new URL(String(href), window.location.href);
    return url.pathname + url.search;
  };

  const isChatLink = (a) => !!chatIdFromHref(a?.getAttribute?.("href"));

  const chatLinksIn = (root) =>
    safeAll(root, SITE.linkSelector).filter((a) => isChatLink(a) && !inZone(a));

  const countChatLinks = (node) => chatLinksIn(node).length;

  // The sidebar is the only place where the Folders section is mounted and
  // where foldered chats are hidden.
  // Candidates in priority order. A candidate that also wraps the main
  // content (e.g. a layout container) is rejected, otherwise search results
  // would count as "sidebar".
  const getSidebarRoot = () => {
    for (const selector of SITE.sidebarSelectors) {
      const candidates = safeAll(document, selector).filter(
        (node) => !node.querySelector(SITE.mainSelector),
      );
      const best =
        candidates.find((r) => r.querySelector(SITE.sidebarMarker)) ||
        candidates.find((r) => countChatLinks(r) > 0) ||
        candidates[0];
      if (best) return best;
    }
    return null;
  };

  // A small wrapper around exactly one chat (link + options button), not the
  // list itself – hiding a list would also hide chats added to it later.
  const isRowWrapper = (node) => {
    if (!node || node === document.body || node === document.documentElement) return false;
    if (safeMatches(node, SIDEBAR_ROOT_SELECTOR) || safeMatches(node, SITE.listSelector)) return false;
    if (dropZone && (node === dropZone || node.contains(dropZone))) return false;
    return countChatLinks(node) === 1 && node.children.length <= 3;
  };

  const itemForLink = (link) => {
    const known = link.closest(SITE.itemSelector);
    if (known && countChatLinks(known) <= 1) {
      const outer = SITE.legacyItemSelector
        ? known.parentElement?.closest(SITE.legacyItemSelector)
        : null;
      const base = outer && countChatLinks(outer) <= 1 ? outer : known;
      const parent = base.parentElement;
      return parent && isRowWrapper(parent) ? parent : base;
    }
    let node = link;
    for (let depth = 0; depth < 4; depth += 1) {
      const parent = node.parentElement;
      if (!parent || !isRowWrapper(parent)) break;
      node = parent;
    }
    return node;
  };

  const getItemsIn = (root) => {
    if (!root) return [];
    const items = new Set(chatLinksIn(root).map(itemForLink));
    if (!SITE.legacyItemSelector) return [...items];
    // Older markup without chat links.
    safeAll(root, SITE.legacyItemSelector).forEach((node) => {
      if (inZone(node)) return;
      if (![...items].some((i) => i.contains(node) || node.contains(i))) items.add(node);
    });
    return [...items];
  };

  const getSidebarItems = () => getItemsIn(getSidebarRoot());
  const getAllItems = () => getItemsIn(document);

  const getChatInfo = (item) => {
    if (!item) return null;
    const link =
      (item.matches?.("a[href]") ? item : null) ||
      chatLinksIn(item)[0] ||
      item.querySelector("a[href]") ||
      item.closest?.("a[href]");
    let href = link?.getAttribute("href") || "";

    let id = chatIdFromHref(href);
    if (!id) href = "";
    if (id) {
      // Store a same-origin path, never an absolute foreign URL.
      const url = new URL(href, window.location.href);
      href = url.pathname + url.search;
    }
    if (!id) {
      const jslogOwner = item.matches?.("[jslog]") ? item : item.querySelector("[jslog]");
      id = (jslogOwner?.getAttribute("jslog") || "").match(/c_([a-zA-Z0-9]{6,})/)?.[1] || "";
    }
    if (!id) {
      const dataId =
        item.getAttribute("data-conversation-id") ||
        item.querySelector("[data-conversation-id]")?.getAttribute("data-conversation-id");
      if (dataId) id = dataId.replace(/^c_/, "");
    }
    if (!href && id) href = SITE.chatHref(id);

    const title =
      cleanText(item.querySelector(SITE.titleSelector)?.textContent) ||
      cleanText(link?.getAttribute("aria-label")) ||
      cleanText(link?.textContent) ||
      cleanText(item.textContent) ||
      "Unbenannter Chat";

    return { key: id ? `id:${id}` : `title:${title}`, title, href };
  };

  const nativeItemFromTarget = (target) => {
    if (!target || inZone(target)) return null;
    const link = target.closest("a[href]");
    if (link && isChatLink(link)) return itemForLink(link);
    const wrapper = target.closest(SITE.itemSelector);
    if (wrapper && countChatLinks(wrapper) <= 1) return wrapper;
    const inner = chatLinksIn(target)[0];
    if (!inner) return null;
    return countChatLinks(target) === 1 ? itemForLink(inner) : null;
  };

  const uniqueChats = (items) => {
    const seen = new Set();
    return items
      .map(getChatInfo)
      .filter((c) => c && !seen.has(c.key) && seen.add(c.key));
  };

  const findItemByKey = (key) =>
    getSidebarItems().find((i) => getChatInfo(i)?.key === key) ||
    getAllItems().find((i) => getChatInfo(i)?.key === key) ||
    null;

  const storedKeys = () => {
    const keys = new Set(state.looseChats.map((c) => c.key));
    state.folders.forEach((f) => f.chats.forEach((c) => keys.add(c.key)));
    return keys;
  };

  const findFolderByName = (name) => {
    const needle = cleanText(name).toLowerCase();
    return state.folders.find((f) => f.name.toLowerCase() === needle) || null;
  };

  // Hides foldered chats in the sidebar only. Search results and other
  // chat lists on the page always show every chat.
  let titleChanged = false;
  const syncNativeItems = () => {
    const keys = storedKeys();
    const sidebarItems = getSidebarItems();
    const sidebarSet = new Set(sidebarItems);

    sidebarItems.forEach((item) => {
      if (item.getAttribute("draggable") !== "true") item.setAttribute("draggable", "true");
      const info = getChatInfo(item);
      if (!info) return;
      const hide = keys.has(info.key);
      if (item.hasAttribute(HIDDEN_ATTR) !== hide) item.toggleAttribute(HIDDEN_ATTR, hide);
      updateStoredTitle(info);
    });

    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((node) => {
      if (!sidebarSet.has(node)) node.removeAttribute(HIDDEN_ATTR);
    });
  };

  // Chats can be renamed in Gemini; only trust sidebar titles for that.
  const updateStoredTitle = (info) => {
    const update = (chat) => {
      if (chat.key === info.key && info.title && chat.title !== info.title) {
        chat.title = info.title;
        if (info.href) chat.href = info.href;
        titleChanged = true;
      }
    };
    state.looseChats.forEach(update);
    state.folders.forEach((f) => f.chats.forEach(update));
  };

  // ---------------------------------------------------------------------------
  // State mutations
  // ---------------------------------------------------------------------------
  const removeChatEverywhere = (key) => {
    state.looseChats = state.looseChats.filter((c) => c.key !== key);
    state.folders.forEach((f) => {
      const before = f.chats.length;
      f.chats = f.chats.filter((c) => c.key !== key);
      if (f.chats.length !== before) f.updatedAt = new Date().toISOString();
    });
  };

  const moveChat = (chat, folderId) => {
    const normalized = normalizeChat(chat);
    if (!normalized) return;
    removeChatEverywhere(normalized.key);
    const folder = folderId ? state.folders.find((f) => f.id === folderId) : null;
    if (folder) {
      folder.chats.push(normalized);
      folder.expanded = true;
      folder.updatedAt = new Date().toISOString();
      state.collapsed = false;
    } else {
      state.looseChats.push(normalized);
    }
  };

  const createFolder = (name) => {
    if (state.folders.length >= settings.maxFolders) {
      return { ok: false, reason: "max-folders", max: settings.maxFolders };
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
  };

  const createFolderOrWarn = (name) => {
    const result = createFolder(name);
    if (!result.ok) toast(`Maximal ${result.max} Ordner erlaubt (siehe Einstellungen).`);
    return result.ok ? result.folder : null;
  };

  const pruneExpiredFolders = () => {
    const days = settings.autoDeleteDays;
    if (!days) return false;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const before = state.folders.length;
    state.folders = state.folders.filter((f) => new Date(f.updatedAt).getTime() >= cutoff);
    return state.folders.length !== before;
  };

  // ---------------------------------------------------------------------------
  // Theme + styles
  // ---------------------------------------------------------------------------
  const detectTheme = () => {
    const body = document.body;
    if (!body) return "dark";
    if (body.classList.contains("dark-theme")) return "dark";
    if (body.classList.contains("light-theme")) return "light";
    // ChatGPT sets the theme as a class on <html>.
    const root = document.documentElement;
    if (root.classList.contains("dark")) return "dark";
    if (root.classList.contains("light")) return "light";
    const bg = getComputedStyle(body).backgroundColor || "";
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (m && (m[4] === undefined || parseFloat(m[4]) > 0)) {
      const lum = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
      return lum < 0.5 ? "dark" : "light";
    }
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };

  const applyTheme = () => {
    const theme = detectTheme();
    if (document.documentElement.dataset.gaTheme !== theme) {
      document.documentElement.dataset.gaTheme = theme;
    }
    if (document.documentElement.dataset.gaSite !== SITE.id) {
      document.documentElement.dataset.gaSite = SITE.id;
    }
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const Z = `#${ZONE_ID}`;
    const P = `#${PICKER_ID}`;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --ga-fg: #e3e3e3; --ga-muted: #a8abb1; --ga-hover: rgba(255,255,255,.08);
        --ga-active: #1f3760; --ga-active-fg: #d3e3fd; --ga-accent: #a8c7fa;
        --ga-border: rgba(255,255,255,.14); --ga-surface: #1e1f20; --ga-surface-2: #282a2c;
        --ga-drop: rgba(168,199,250,.14); --ga-danger: #f28b82;
        --ga-font: "Google Sans Text", "Google Sans", Roboto, Arial, sans-serif;
      }
      :root[data-ga-theme="light"] {
        --ga-fg: #1f1f1f; --ga-muted: #5f6368; --ga-hover: rgba(0,0,0,.06);
        --ga-active: #d3e3fd; --ga-active-fg: #041e49; --ga-accent: #0b57d0;
        --ga-border: rgba(0,0,0,.14); --ga-surface: #ffffff; --ga-surface-2: #f0f4f9;
        --ga-drop: rgba(11,87,208,.10); --ga-danger: #b3261e;
      }
      /* ChatGPT: its own font and the neutral grey highlight of its sidebar. */
      :root[data-ga-site="chatgpt"] {
        --ga-font: ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
        --ga-active: rgba(255,255,255,.12); --ga-active-fg: #ffffff; --ga-surface: #212121; --ga-surface-2: #303030;
      }
      :root[data-ga-site="chatgpt"][data-ga-theme="light"] {
        --ga-active: rgba(0,0,0,.08); --ga-active-fg: #0d0d0d; --ga-surface: #ffffff; --ga-surface-2: #f4f4f4;
      }
      [${HIDDEN_ATTR}] { display: none !important; }

      ${Z} {
        display: block; box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0;
        overflow: hidden; margin: 4px 0 12px; padding: 2px 0; border-radius: 16px;
        color: var(--ga-fg); font-family: var(--ga-font); font-size: 14px; line-height: 20px;
        transition: background-color .15s, box-shadow .15s;
      }
      ${Z} *, ${Z} *::before, ${Z} *::after { box-sizing: border-box; }
      ${Z}.ga-dragging { box-shadow: inset 0 0 0 1px var(--ga-border); }
      ${Z}.ga-drop-active { background: var(--ga-drop); box-shadow: inset 0 0 0 1.5px var(--ga-accent); }
      ${Z} .ga-icon { flex: none; display: block; }
      ${Z} button { font: inherit; }

      ${Z} .ga-section-header { display: flex; align-items: center; min-height: 36px; padding-right: 4px; }
      ${Z} .ga-section-toggle {
        flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; height: 32px;
        padding: 0 8px 0 12px; border: 0; border-radius: 16px; background: none;
        color: var(--ga-fg); font-weight: 500; cursor: pointer; text-align: left;
      }
      ${Z} .ga-section-toggle:hover { background: var(--ga-hover); }
      ${Z} .ga-section-toggle .ga-chevron { color: var(--ga-muted); transition: transform .15s; }
      ${Z} .ga-section[data-collapsed="false"] .ga-section-toggle .ga-chevron { transform: rotate(90deg); }
      ${Z} .ga-section-count { margin-left: 4px; color: var(--ga-muted); font-weight: 400; font-size: 12px; }

      ${Z} .ga-row {
        position: relative; display: flex; align-items: center; min-height: 36px;
        margin: 0 0 1px; border-radius: 18px; color: var(--ga-fg); transition: background-color .12s;
      }
      ${Z} .ga-row:hover { background: var(--ga-hover); }
      ${Z} .ga-row-main {
        flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 36px;
        padding: 0 6px 0 12px; border: 0; border-radius: 18px; background: none;
        color: inherit; text-align: left; text-decoration: none; cursor: pointer;
      }
      ${Z} .ga-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      ${Z} .ga-count {
        flex: none; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
        font-size: 12px; line-height: 20px; text-align: center; color: var(--ga-muted); background: var(--ga-hover);
      }
      ${Z} .ga-chevron { color: var(--ga-muted); transition: transform .15s; }
      ${Z} .ga-folder[data-expanded="true"] > .ga-folder-header .ga-chevron { transform: rotate(90deg); }
      ${Z} .ga-folder-icon { color: var(--ga-accent); }
      ${Z} .ga-chat .ga-icon { color: var(--ga-muted); }

      ${Z} .ga-actions { display: flex; align-items: center; padding-right: 4px; opacity: 0; transition: opacity .12s; }
      ${Z} .ga-row:hover .ga-actions, ${Z} .ga-row:focus-within .ga-actions { opacity: 1; }
      ${Z} .ga-btn {
        display: inline-flex; align-items: center; justify-content: center; flex: none;
        width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%;
        background: none; color: var(--ga-muted); cursor: pointer;
      }
      ${Z} .ga-btn:hover { background: var(--ga-hover); color: var(--ga-fg); }
      ${Z} .ga-btn.ga-danger:hover { color: var(--ga-danger); }
      ${Z} .ga-row-main:focus-visible, ${Z} .ga-btn:focus-visible, ${Z} .ga-section-toggle:focus-visible {
        outline: 2px solid var(--ga-accent); outline-offset: -2px;
      }

      ${Z} .ga-chat.ga-active { background: var(--ga-active); color: var(--ga-active-fg); }
      ${Z} .ga-chat.ga-active .ga-icon { color: inherit; }
      ${Z} .ga-chat.ga-active .ga-label { font-weight: 500; }
      ${Z} .ga-row.ga-dragging-row { opacity: .5; }
      ${Z} .ga-folder.ga-drop-target > .ga-folder-header {
        background: var(--ga-drop); box-shadow: inset 0 0 0 1.5px var(--ga-accent);
      }

      ${Z} .ga-folder-content { display: none; margin: 0 0 4px 21px; padding-left: 6px; border-left: 1px solid var(--ga-border); }
      ${Z} .ga-folder[data-expanded="true"] > .ga-folder-content { display: block; }
      ${Z} .ga-folder-content .ga-row { min-height: 32px; }
      ${Z} .ga-folder-content .ga-row-main { height: 32px; padding-left: 10px; }

      ${Z} .ga-hint { padding: 6px 12px; font-size: 12px; line-height: 16px; color: var(--ga-muted); }
      ${Z} .ga-drop-hint {
        display: none; margin: 4px 8px; padding: 8px; border: 1px dashed var(--ga-border);
        border-radius: 12px; text-align: center; font-size: 12px; color: var(--ga-muted);
      }
      ${Z}.ga-dragging .ga-drop-hint { display: block; }

      ${Z} .ga-edit-row { gap: 10px; padding: 0 8px 0 12px; background: var(--ga-hover); }
      ${Z} .ga-name-input {
        flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid var(--ga-accent);
        border-radius: 8px; background: var(--ga-surface); color: var(--ga-fg); font: inherit; outline: none;
      }

      ${P} {
        display: inline-flex; align-items: center; gap: 6px; flex: none; align-self: center;
        max-width: 180px; height: 40px; margin: 0 2px; padding: 0 8px 0 12px;
        border: 0; border-radius: 20px; background: transparent; color: var(--ga-fg);
        font-family: var(--ga-font); font-size: 14px; line-height: 20px; font-weight: 500;
        cursor: pointer; box-sizing: border-box; transition: background-color .12s;
      }
      ${P}:hover, ${P}[aria-expanded="true"] { background: var(--ga-hover); }
      ${P}:focus-visible { outline: 2px solid var(--ga-accent); outline-offset: -2px; }
      ${P} .ga-icon { flex: none; }
      ${P} .ga-chip-icon { color: var(--ga-muted); }
      ${P}.ga-chip-set .ga-chip-icon { color: var(--ga-accent); }
      ${P} .ga-chip-caret { color: var(--ga-muted); }
      ${P} .ga-chip-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      ${P}:not(.ga-chip-set) .ga-chip-label { color: var(--ga-muted); }

      .ga-picker-menu {
        position: fixed; z-index: 2147483646; box-sizing: border-box;
        width: 272px; max-height: min(400px, 70vh); overflow-y: auto; padding: 8px 0;
        border-radius: 16px; background: var(--ga-surface-2); color: var(--ga-fg);
        box-shadow: 0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3);
        font-family: var(--ga-font); font-size: 14px; line-height: 20px;
      }
      .ga-picker-menu * { box-sizing: border-box; }
      .ga-picker-menu .ga-menu-title { padding: 8px 16px 6px; font-size: 12px; line-height: 16px; color: var(--ga-muted); }
      .ga-picker-menu .ga-menu-divider { height: 1px; margin: 6px 0; background: var(--ga-border); }
      .ga-picker-menu .ga-menu-note { padding: 4px 16px 6px 46px; font-size: 12px; line-height: 16px; color: var(--ga-muted); }
      .ga-picker-menu .ga-menu-create {
        display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 4px 8px 4px 16px;
      }
      .ga-picker-menu .ga-menu-input {
        flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--ga-accent);
        border-radius: 8px; background: var(--ga-surface); color: var(--ga-fg); font: inherit; outline: none;
      }
      .ga-picker-menu .ga-menu-save {
        display: inline-flex; align-items: center; justify-content: center; flex: none;
        width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%;
        background: none; color: var(--ga-accent); cursor: pointer;
      }
      .ga-picker-menu .ga-menu-save:hover { background: var(--ga-hover); }
      .ga-picker-menu .ga-menu-save:focus-visible { outline: 2px solid var(--ga-accent); outline-offset: 1px; }
      .ga-picker-menu .ga-menu-item {
        display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px;
        padding: 6px 16px; border: 0; background: none; color: inherit; font: inherit;
        text-align: left; cursor: pointer;
      }
      .ga-picker-menu .ga-menu-item:hover, .ga-picker-menu .ga-menu-item:focus-visible {
        background: var(--ga-hover); outline: none;
      }
      .ga-picker-menu .ga-menu-item:focus-visible { box-shadow: inset 0 0 0 2px var(--ga-accent); }
      .ga-picker-menu .ga-menu-icon { color: var(--ga-muted); }
      .ga-picker-menu .ga-menu-item[data-value="__auto__"] .ga-menu-icon,
      .ga-picker-menu .ga-menu-item[data-action] .ga-menu-icon { color: var(--ga-accent); }
      .ga-picker-menu .ga-menu-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .ga-picker-menu .ga-menu-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ga-picker-menu .ga-menu-hint { font-size: 12px; line-height: 16px; color: var(--ga-muted); }
      .ga-picker-menu .ga-menu-check { visibility: hidden; color: var(--ga-accent); }
      .ga-picker-menu .ga-menu-item[aria-checked="true"] .ga-menu-check { visibility: visible; }
      .ga-picker-menu .ga-menu-item[aria-checked="true"] .ga-menu-label { font-weight: 500; }

      #${TOAST_ID} {
        position: fixed; left: 50%; bottom: 24px; z-index: 2147483647; max-width: min(480px, 90vw);
        padding: 10px 16px; border-radius: 8px; background: var(--ga-fg); color: var(--ga-surface);
        font-family: var(--ga-font); font-size: 14px; line-height: 20px;
        box-shadow: 0 4px 16px rgba(0,0,0,.3); opacity: 0; pointer-events: none;
        transform: translate(-50%, 16px); transition: opacity .2s, transform .2s;
      }
      #${TOAST_ID}.ga-show { opacity: 1; transform: translate(-50%, 0); }

      @media (prefers-reduced-motion: reduce) {
        ${Z}, ${Z} *, #${TOAST_ID} { transition: none !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    cleanups.push(() => style.remove());
  };

  // ---------------------------------------------------------------------------
  // Small DOM helpers
  // ---------------------------------------------------------------------------
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // SVGs are built via DOM APIs (no innerHTML) to stay Trusted-Types safe.
  const svgIcon = (path, size = 18, className = "ga-icon") => {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);
    const p = document.createElementNS(NS, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
  };

  const iconButton = (label, path, onClick, extraClass = "") => {
    const btn = el("button", `ga-btn ${extraClass}`.trim());
    btn.type = "button";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.append(svgIcon(path, 18));
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  let toastTimer = null;
  const toast = (text) => {
    if (!document.body) return;
    let node = document.getElementById(TOAST_ID);
    if (!node) {
      node = el("div");
      node.id = TOAST_ID;
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
      const ref = node;
      cleanups.push(() => ref.remove());
    }
    node.textContent = text;
    node.classList.add("ga-show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("ga-show"), 3500);
  };

  // ---------------------------------------------------------------------------
  // Rendering: Folders section
  // ---------------------------------------------------------------------------
  const renderNameInput = (initial, onDone) => {
    const row = el("div", "ga-row ga-edit-row");
    const input = el("input", "ga-name-input");
    input.type = "text";
    input.value = initial;
    input.maxLength = 80;
    input.placeholder = "Ordnername";
    input.setAttribute("aria-label", "Ordnername");
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      onDone(save ? cleanText(input.value) : null);
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // keep Gemini's shortcuts out of it
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
    // Ignore the blur caused by our own re-render removing the input.
    input.addEventListener("blur", () => {
      if (!rendering && input.isConnected) finish(true);
    });
    row.append(svgIcon(ICONS.folder, 18, "ga-icon ga-folder-icon"), input);
    pendingFocus = input;
    return row;
  };

  const startCreate = () => {
    state.collapsed = false;
    editing = { type: "new" };
    render();
  };

  const renderChat = (chat, folderId) => {
    const row = el("div", "ga-row ga-chat");
    row.dataset.key = chat.key;
    row.setAttribute("draggable", "true");
    const active = chat.key === activeKey;
    if (active) row.classList.add("ga-active");

    const link = el("a", "ga-row-main");
    link.href = chat.href || "#";
    link.title = chat.title;
    link.setAttribute("draggable", "false");
    if (active) link.setAttribute("aria-current", "page");
    link.append(svgIcon(ICONS.chat, 16), el("span", "ga-label", chat.title));
    link.addEventListener("click", (e) => {
      // Let ctrl/cmd/middle click open a new tab as usual.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openChat(chat);
    });

    const actions = el("div", "ga-actions");
    actions.append(
      iconButton(folderId ? "Aus Ordner entfernen" : "Aus Folders entfernen", ICONS.close, () => {
        removeChatEverywhere(chat.key);
        commit();
      }),
    );

    row.append(link, actions);
    row.addEventListener("dragstart", (e) => {
      setDragData(e, chat);
      currentDrag = chat;
      row.classList.add("ga-dragging-row");
      setDragging(true);
    });
    row.addEventListener("dragend", () => row.classList.remove("ga-dragging-row"));
    return row;
  };

  const renderFolder = (folder) => {
    const wrap = el("div", "ga-folder");
    wrap.dataset.folderId = folder.id;
    wrap.dataset.expanded = folder.expanded ? "true" : "false";

    let header;
    if (editing?.type === "rename" && editing.id === folder.id) {
      header = renderNameInput(folder.name, (name) => {
        editing = null;
        if (name && name !== folder.name) {
          folder.name = name;
          folder.updatedAt = new Date().toISOString();
          commit();
        } else {
          render();
        }
      });
      header.classList.add("ga-folder-header");
    } else {
      header = el("div", "ga-row ga-folder-header");
      const main = el("button", "ga-row-main");
      main.type = "button";
      main.title = folder.name;
      main.setAttribute("aria-expanded", folder.expanded ? "true" : "false");
      main.append(
        svgIcon(ICONS.chevron, 18, "ga-icon ga-chevron"),
        svgIcon(folder.expanded ? ICONS.folderOpen : ICONS.folder, 18, "ga-icon ga-folder-icon"),
        el("span", "ga-label", folder.name),
        el("span", "ga-count", String(folder.chats.length)),
      );
      main.addEventListener("click", (e) => {
        e.preventDefault();
        folder.expanded = !folder.expanded;
        commit();
      });

      const actions = el("div", "ga-actions");
      actions.append(
        iconButton(`„${folder.name}“ umbenennen`, ICONS.edit, () => {
          editing = { type: "rename", id: folder.id };
          render();
        }),
        iconButton(
          `„${folder.name}“ löschen`,
          ICONS.delete,
          () => {
            const ok = window.confirm(
              `Ordner „${folder.name}“ löschen? Die Chats erscheinen wieder in der normalen Liste.`,
            );
            if (!ok) return;
            state.folders = state.folders.filter((f) => f.id !== folder.id);
            commit();
            toast(`Ordner „${folder.name}“ gelöscht.`);
          },
          "ga-danger",
        ),
      );
      header.append(main, actions);
    }

    const content = el("div", "ga-folder-content");
    content.setAttribute("role", "group");
    content.setAttribute("aria-label", folder.name);
    if (!folder.chats.length) content.append(el("div", "ga-hint", "Leer – Chats hierher ziehen"));
    folder.chats.forEach((chat) => content.append(renderChat(chat, folder.id)));

    wrap.append(header, content);
    return wrap;
  };

  let rendering = false;
  const render = () => {
    if (!dropZone) return;
    rendering = true;
    try {
      renderSection();
    } finally {
      rendering = false;
    }
    if (pendingFocus) {
      const input = pendingFocus;
      pendingFocus = null;
      input.focus();
      input.select();
    }
    refreshPickerOptions();
  };

  const renderSection = () => {
    const section = el("div", "ga-section");
    section.dataset.collapsed = state.collapsed ? "true" : "false";

    const header = el("div", "ga-section-header");
    const toggle = el("button", "ga-section-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", state.collapsed ? "false" : "true");
    toggle.append(
      el("span", "ga-label", "Folders"),
      svgIcon(ICONS.chevron, 16, "ga-icon ga-chevron"),
    );
    if (state.folders.length) {
      toggle.querySelector(".ga-label").append(el("span", "ga-section-count", String(state.folders.length)));
    }
    toggle.addEventListener("click", () => {
      state.collapsed = !state.collapsed;
      commit();
    });
    header.append(toggle, iconButton("Neuer Ordner", ICONS.add, startCreate));

    const body = el("div", "ga-section-body");
    body.hidden = state.collapsed;

    if (editing?.type === "new") {
      body.append(
        renderNameInput("", (name) => {
          editing = null;
          if (!name) return render();
          if (createFolderOrWarn(name)) commit();
          else render();
        }),
      );
    }
    state.folders.forEach((f) => body.append(renderFolder(f)));
    state.looseChats.forEach((c) => body.append(renderChat(c, null)));
    if (!state.folders.length && !state.looseChats.length && editing?.type !== "new") {
      body.append(el("div", "ga-hint", "Chats hierher ziehen oder mit + einen Ordner erstellen."));
    }
    body.append(el("div", "ga-drop-hint", "Hier ablegen (ohne Ordner) oder auf einen Ordner ziehen"));

    section.append(header, body);
    dropZone.replaceChildren(section);
  };

  // ---------------------------------------------------------------------------
  // Navigation + active state
  // ---------------------------------------------------------------------------
  const keyFromLocation = () => {
    const id = chatIdFromHref(window.location.pathname);
    return id ? `id:${id}` : null;
  };

  const setActive = (key) => {
    activeKey = key && storedKeys().has(key) ? key : null;
    dropZone?.querySelectorAll(".ga-chat").forEach((row) => {
      const on = !!activeKey && row.dataset.key === activeKey;
      row.classList.toggle("ga-active", on);
      const link = row.querySelector(".ga-row-main");
      if (on) link?.setAttribute("aria-current", "page");
      else link?.removeAttribute("aria-current");
    });
  };

  const openChat = (chat) => {
    setActive(chat.key);
    const item = findItemByKey(chat.key);
    const link =
      item && (item.matches("a[href]") && isChatLink(item) ? item : chatLinksIn(item)[0]);
    if (link) {
      // Works for hidden elements too and keeps the site's SPA navigation.
      link.click();
      return;
    }
    const href = safeChatHref(chat.href);
    if (href) window.location.assign(href);
  };

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------
  let currentDrag = null; // chat being dragged (dataTransfer may be replaced by Gemini)

  const setDragData = (e, chat) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(chat));
    e.dataTransfer.setData("text/plain", chat.title);
    e.dataTransfer.effectAllowed = "move";
  };

  const setDragging = (on) => dropZone?.classList.toggle("ga-dragging", on);

  const dragTypes = (e) => Array.from(e.dataTransfer?.types || []);
  const isOurDrag = (e) =>
    !!currentDrag || dragTypes(e).includes(DRAG_MIME) || dragTypes(e).includes("text/uri-list");

  const chatFromUrl = (url) => {
    const id = chatIdFromHref(url);
    if (!id) return null;
    const key = `id:${id}`;
    const item = findItemByKey(key);
    return item ? getChatInfo(item) : { key, title: "Unbenannter Chat", href: SITE.chatHref(id) };
  };

  const readDragData = (e) => {
    try {
      const raw = e.dataTransfer?.getData(DRAG_MIME);
      if (raw) return JSON.parse(raw);
    } catch {
      // fall through
    }
    return (
      currentDrag ||
      chatFromUrl(e.dataTransfer?.getData("text/uri-list")) ||
      chatFromUrl(e.dataTransfer?.getData("text/plain"))
    );
  };

  const clearDropHighlights = () => {
    dropZone?.classList.remove("ga-drop-active");
    dropZone?.querySelectorAll(".ga-drop-target").forEach((f) => f.classList.remove("ga-drop-target"));
  };

  // Chats from the sidebar *and* from the search page can be dragged.
  const bindNativeDrag = () => {
    const onDragStart = (e) => {
      const target = e.target instanceof Element ? e.target : e.target?.parentElement;
      const item = nativeItemFromTarget(target);
      if (!item) return;
      const info = getChatInfo(item);
      if (!info) return;
      setDragData(e, info);
      currentDrag = info;
      setDragging(true);
    };
    const onDragEnd = () => {
      window.setTimeout(() => {
        currentDrag = null;
      }, 0);
      setDragging(false);
      clearDropHighlights();
    };
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragend", onDragEnd, true);
    cleanups.push(
      () => document.removeEventListener("dragstart", onDragStart, true),
      () => document.removeEventListener("dragend", onDragEnd, true),
    );
  };

  const bindDropZone = (zone) => {
    zone.addEventListener("dragover", (e) => {
      if (!isOurDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const folderEl = e.target instanceof Element ? e.target.closest(".ga-folder") : null;
      zone.querySelectorAll(".ga-drop-target").forEach((f) => {
        if (f !== folderEl) f.classList.remove("ga-drop-target");
      });
      folderEl?.classList.add("ga-drop-target");
      zone.classList.toggle("ga-drop-active", !folderEl);
    });

    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) clearDropHighlights();
    });

    zone.addEventListener("drop", (e) => {
      if (!isOurDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      clearDropHighlights();
      setDragging(false);
      const chat = readDragData(e);
      currentDrag = null;
      if (!chat?.key) return;
      const folderEl = e.target instanceof Element ? e.target.closest(".ga-folder") : null;
      moveChat(chat, folderEl?.dataset.folderId || null);
      activeKey = chat.key === keyFromLocation() ? chat.key : activeKey;
      commit();
    });
  };

  // ---------------------------------------------------------------------------
  // Mounting (sidebar only)
  // ---------------------------------------------------------------------------
  const findRecentHeading = (root) =>
    Array.from(root.querySelectorAll("*")).find(
      (node) =>
        node.childElementCount === 0 &&
        !inZone(node) &&
        RECENT_HEADING_RE.test(cleanText(node.textContent)),
    ) || null;

  const findMountPoint = (root) => {
    for (const point of SITE.mountPoints) {
      const ref = safeAll(root, point.selector).find((node) => !inZone(node));
      if (ref?.parentElement) return { ref, where: point.where };
    }
    const firstItem = getItemsIn(root)[0];
    if (firstItem?.parentElement?.parentElement) return { ref: firstItem.parentElement, where: "before" };
    const heading = findRecentHeading(root);
    if (heading) {
      const block = /^(SPAN|B|STRONG|EM|SMALL)$/.test(heading.tagName) ? heading.parentElement : heading;
      if (block) return { ref: block, where: "after" };
    }
    return null;
  };

  const mountDropZone = () => {
    if (!dropZone) {
      document.getElementById(ZONE_ID)?.remove(); // leftover of an old instance
      dropZone = el("div");
      dropZone.id = ZONE_ID;
      dropZone.setAttribute("role", "region");
      dropZone.setAttribute("aria-label", "Folders");
      const zone = dropZone;
      cleanups.push(() => zone.remove());
      bindDropZone(dropZone);
      render();
    }

    const root = getSidebarRoot();
    if (!root) {
      // No sidebar (yet) – never place the section anywhere else.
      if (dropZone.isConnected) dropZone.remove();
      return false;
    }
    if (dropZone.isConnected && root.contains(dropZone)) return true;

    const point = findMountPoint(root);
    if (!point) {
      if (dropZone.isConnected) dropZone.remove();
      return false;
    }
    if (point.where === "after") point.ref.after(dropZone);
    else point.ref.before(dropZone);
    return true;
  };

  // ---------------------------------------------------------------------------
  // Folder picker for a new chat (above the prompt input)
  // ---------------------------------------------------------------------------
  let picker = null;
  let pickerChoice = "";
  let pickerSuggestion = null; // name of an AI-suggested *new* folder
  let pendingAssign = null; // { choice, prompt, at }

  const isNewChatPage = () => SITE.newChatPathRe.test(window.location.pathname);

  const getEditor = () => safeAll(document, SITE.editorSelector)[0] || null;
  const getEditorText = () => {
    const editor = getEditor();
    if (!editor) return "";
    if (editor.tagName === "TEXTAREA") return cleanText(editor.value);
    return cleanText(editor.innerText ?? editor.textContent ?? "");
  };

  // The picker is a compact chip inside Gemini's input toolbar (next to the
  // Flash/Pro switcher and the mic). Its menu is attached to <body> with
  // fixed positioning so the input box can't clip it.
  let pickerMenu = null;
  let suggesting = false;

  const choiceLabel = () => {
    if (pickerChoice === AUTO) return "Automatisch";
    if (pickerChoice.startsWith(NEW_PREFIX)) return pickerChoice.slice(NEW_PREFIX.length);
    return state.folders.find((f) => f.id === pickerChoice)?.name || "Ordner";
  };

  const validateChoice = () => {
    if (!aiEnabled) {
      // Key was removed: drop AI-only choices.
      pickerSuggestion = null;
      if (pickerChoice === AUTO || pickerChoice.startsWith(NEW_PREFIX)) pickerChoice = "";
    }
    if (!pickerChoice || pickerChoice === AUTO) return;
    if (pickerChoice.startsWith(NEW_PREFIX)) {
      const name = pickerChoice.slice(NEW_PREFIX.length);
      const existing = findFolderByName(name);
      if (existing) pickerChoice = existing.id;
      return;
    }
    if (!state.folders.some((f) => f.id === pickerChoice)) pickerChoice = "";
  };

  // Updates the chip (and the menu if open) after state/choice changes.
  const refreshPickerOptions = () => {
    validateChoice();
    if (!picker) return;
    const label = picker.querySelector(".ga-chip-label");
    if (label) label.textContent = suggesting ? "Suche …" : choiceLabel();
    picker.classList.toggle("ga-chip-set", !!pickerChoice);
    picker.setAttribute(
      "aria-label",
      `Ordner für diesen Chat: ${pickerChoice ? choiceLabel() : "kein Ordner"}`,
    );
    picker.title = pickerChoice
      ? `Wird beim Senden in „${choiceLabel()}“ einsortiert`
      : "Ordner für diesen Chat wählen";
    // Only re-render an open menu if its content actually changed – this
    // runs on every page mutation and would otherwise reset focus/typing.
    if (pickerMenu && !menuCreating && menuSignature() !== renderedMenuSig) {
      const focusedValue = document.activeElement?.dataset?.value;
      const focusedAction = document.activeElement?.dataset?.action;
      renderMenuItems();
      const again = menuButtons().find((b) =>
        focusedAction ? b.dataset.action === focusedAction : b.dataset.value === focusedValue,
      );
      again?.focus();
    }
  };

  let renderedMenuSig = "";
  const menuSignature = () => JSON.stringify([pickerChoice, menuCreating, menuItems()]);

  const askFolderSuggestion = (prompt) =>
    sendToBackground({ type: "ga:suggest-folder", prompt: prompt.slice(0, 4000) });

  const suggestNow = async () => {
    if (!aiEnabled) return;
    const text = getEditorText();
    if (!text) {
      toast("Erst eine Nachricht eingeben, dann vorschlagen lassen.");
      return;
    }
    suggesting = true;
    refreshPickerOptions();
    const res = await askFolderSuggestion(text);
    suggesting = false;
    if (!res?.ok || !res.name) {
      refreshPickerOptions();
      toast(res?.error || "Kein Vorschlag erhalten.");
      return;
    }
    const existing = findFolderByName(res.name);
    if (existing) {
      pickerSuggestion = null;
      pickerChoice = existing.id;
    } else {
      pickerSuggestion = res.name;
      pickerChoice = NEW_PREFIX + res.name;
    }
    refreshPickerOptions();
    toast(existing ? `Vorschlag: „${res.name}“` : `Vorschlag: neuer Ordner „${res.name}“`);
  };

  let menuCreating = false; // inline "new folder" input is shown

  const menuItems = () => {
    const items = [
      { title: aiEnabled ? "Manuell" : "Chat einsortieren in" },
      { value: "", label: "Kein Ordner", icon: ICONS.close },
    ];
    state.folders.forEach((f) => items.push({ value: f.id, label: f.name, icon: ICONS.folder }));
    if (aiEnabled && pickerSuggestion && !findFolderByName(pickerSuggestion)) {
      items.push({
        value: NEW_PREFIX + pickerSuggestion,
        label: pickerSuggestion,
        hint: "KI-Vorschlag · wird beim Senden erstellt",
        icon: ICONS.folder,
      });
    }
    if (!state.folders.length && !pickerSuggestion) {
      items.push({ note: "Noch keine Ordner vorhanden." });
    }
    items.push({ action: "create", label: "Neuer Ordner …", icon: ICONS.add });
    // AI section only with a saved API key.
    if (!aiEnabled) return items;
    items.push({ divider: true }, { title: "Mit KI" });
    items.push({
      value: AUTO,
      label: "Automatisch (KI)",
      hint: "Ordner wird beim Senden gewählt",
      icon: ICONS.sparkle,
    });
    items.push({
      action: "suggest",
      label: "Jetzt vorschlagen",
      hint: "Anhand der eingegebenen Nachricht",
      icon: ICONS.sparkle,
    });
    return items;
  };

  const menuButtons = () => Array.from(pickerMenu?.querySelectorAll(".ga-menu-item") || []);

  const renderMenuItems = () => {
    if (!pickerMenu) return;
    renderedMenuSig = menuSignature();
    const nodes = [];
    menuItems().forEach((item) => {
      if (item.divider) {
        nodes.push(el("div", "ga-menu-divider"));
        return;
      }
      if (item.title) {
        nodes.push(el("div", "ga-menu-title", item.title));
        return;
      }
      if (item.note) {
        nodes.push(el("div", "ga-menu-note", item.note));
        return;
      }
      if (item.action === "create" && menuCreating) {
        nodes.push(renderCreateRow());
        return;
      }
      const btn = el("button", "ga-menu-item");
      btn.type = "button";
      btn.tabIndex = -1;
      if (item.action) {
        btn.setAttribute("role", "menuitem");
        btn.dataset.action = item.action;
      } else {
        const checked = item.value === pickerChoice;
        btn.setAttribute("role", "menuitemradio");
        btn.setAttribute("aria-checked", checked ? "true" : "false");
        btn.dataset.value = item.value;
      }
      const text = el("span", "ga-menu-text");
      text.append(el("span", "ga-menu-label", item.label));
      if (item.hint) text.append(el("span", "ga-menu-hint", item.hint));
      btn.append(svgIcon(item.icon, 18, "ga-icon ga-menu-icon"), text);
      if (!item.action) btn.append(svgIcon(ICONS.check, 18, "ga-icon ga-menu-check"));
      nodes.push(btn);
    });
    pickerMenu.replaceChildren(...nodes);
  };

  const positionMenu = () => {
    if (!pickerMenu || !picker) return;
    const rect = picker.getBoundingClientRect();
    const menuRect = pickerMenu.getBoundingClientRect();
    const margin = 8;
    const width = menuRect.width || 260;
    const height = menuRect.height || 300;
    let left = Math.min(rect.left, window.innerWidth - width - margin);
    left = Math.max(margin, left);
    // Prefer opening below; flip above if there's no room.
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - margin && rect.top - height - 6 > margin) {
      top = rect.top - height - 6;
    }
    pickerMenu.style.left = `${left}px`;
    pickerMenu.style.top = `${Math.max(margin, top)}px`;
  };

  const closeMenu = (focusChip = false) => {
    menuCreating = false;
    if (!pickerMenu) return;
    pickerMenu.remove();
    pickerMenu = null;
    picker?.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    window.removeEventListener("resize", positionMenu);
    window.removeEventListener("scroll", positionMenu, true);
    if (focusChip) picker?.focus();
  };

  function onOutsidePointer(e) {
    if (pickerMenu?.contains(e.target) || picker?.contains(e.target)) return;
    closeMenu();
  }

  // Inline input inside the menu: type a name, Enter creates the folder
  // right away and selects it for this chat.
  function renderCreateRow() {
    const row = el("div", "ga-menu-create");
    const input = el("input", "ga-menu-input");
    input.type = "text";
    input.maxLength = 80;
    input.placeholder = "Ordnername";
    input.setAttribute("aria-label", "Name des neuen Ordners");
    const save = el("button", "ga-menu-save");
    save.type = "button";
    save.setAttribute("aria-label", "Ordner erstellen");
    save.title = "Erstellen";
    save.append(svgIcon(ICONS.check, 18));

    const submit = () => {
      const name = cleanText(input.value);
      if (!name) {
        input.focus();
        return;
      }
      const folder = findFolderByName(name) || createFolderOrWarn(name);
      if (!folder) return;
      pickerChoice = folder.id;
      menuCreating = false;
      closeMenu(true);
      commit();
      toast(`Wird beim Senden in „${folder.name}“ einsortiert.`);
    };
    const cancel = () => {
      menuCreating = false;
      renderMenuItems();
      pickerMenu?.querySelector('.ga-menu-item[data-action="create"]')?.focus();
    };

    input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // keep menu + Gemini shortcuts out
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    save.addEventListener("click", (e) => {
      e.stopPropagation();
      submit();
    });
    row.append(svgIcon(ICONS.folder, 18, "ga-icon ga-menu-icon"), input, save);
    window.setTimeout(() => input.focus(), 0);
    return row;
  }

  const selectMenuItem = (btn) => {
    if (btn.dataset.action === "create") {
      menuCreating = true;
      renderMenuItems();
      positionMenu();
      return;
    }
    if (btn.dataset.action === "suggest") {
      closeMenu(true);
      suggestNow();
      return;
    }
    pickerChoice = btn.dataset.value || "";
    validateChoice();
    closeMenu(true);
    refreshPickerOptions();
    if (pickerChoice === AUTO) toast("Die KI wählt den Ordner beim Senden.");
  };

  const openMenu = () => {
    if (pickerMenu) return;
    pickerMenu = el("div", "ga-picker-menu");
    pickerMenu.id = `${PICKER_ID}-menu`;
    pickerMenu.setAttribute("role", "menu");
    pickerMenu.setAttribute("aria-label", "Ordner für diesen Chat");
    renderMenuItems();
    document.body.appendChild(pickerMenu);
    positionMenu();
    picker.setAttribute("aria-expanded", "true");

    pickerMenu.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest(".ga-menu-item") : null;
      if (btn) selectMenuItem(btn);
    });
    pickerMenu.addEventListener("keydown", (e) => {
      e.stopPropagation(); // keep Gemini's shortcuts out of it
      const buttons = menuButtons();
      const index = buttons.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        buttons[(index + delta + buttons.length) % buttons.length]?.focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        buttons[e.key === "Home" ? 0 : buttons.length - 1]?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(true);
      } else if (e.key === "Tab") {
        closeMenu();
      } else if ((e.key === "Enter" || e.key === " ") && index !== -1) {
        e.preventDefault();
        selectMenuItem(buttons[index]);
      }
    });
    document.addEventListener("pointerdown", onOutsidePointer, true);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    const buttons = menuButtons();
    (buttons.find((b) => b.getAttribute("aria-checked") === "true") || buttons[0])?.focus();
  };

  const buildPicker = () => {
    const chip = el("button", "ga-picker-chip");
    chip.id = PICKER_ID;
    chip.type = "button";
    chip.setAttribute("aria-haspopup", "menu");
    chip.setAttribute("aria-expanded", "false");
    chip.setAttribute("aria-controls", `${PICKER_ID}-menu`);
    chip.append(
      svgIcon(ICONS.folder, 18, "ga-icon ga-chip-icon"),
      el("span", "ga-chip-label", "Ordner"),
      svgIcon(ICONS.expand, 18, "ga-icon ga-chip-caret"),
    );
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pickerMenu) closeMenu();
      else openMenu();
    });
    chip.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "ArrowDown" && !pickerMenu) {
        e.preventDefault();
        openMenu();
      }
    });
    // Don't let Gemini steal focus back to the editor on mousedown.
    chip.addEventListener("mousedown", (e) => e.stopPropagation());
    cleanups.push(() => closeMenu());
    return chip;
  };

  // Where to put the chip: directly before the model switcher ("Flash"),
  // otherwise before the mic button – both live in the input toolbar.
  const findToolbarAnchor = () => {
    const scope = getEditor()?.closest(SITE.composerSelector) || null;
    // Only look inside the composer if we found one; never place the chip
    // somewhere random on the page.
    const roots = scope ? [scope] : [document];
    for (const selector of SITE.toolbarAnchors) {
      for (const root of roots) {
        const node = safeAll(root, selector).find((n) => !n.closest(`#${PICKER_ID}`));
        if (node?.parentElement) return insertionPoint(node, scope);
      }
    }
    return null;
  };

  // Buttons are often wrapped in single-child <span>/<div>s; insert before
  // the outermost such wrapper so the chip sits in the toolbar row itself.
  const insertionPoint = (node, scope) => {
    let point = node;
    for (let depth = 0; depth < 3; depth += 1) {
      const parent = point.parentElement;
      if (!parent || parent === scope || parent.children.length !== 1) break;
      if (parent.contains(getEditor())) break;
      point = parent;
    }
    return point;
  };

  const mountPicker = () => {
    if (!isNewChatPage()) {
      closeMenu();
      picker?.remove();
      return;
    }
    const anchor = findToolbarAnchor();
    if (!anchor) {
      picker?.remove();
      return;
    }
    if (!picker) {
      picker = buildPicker();
      const ref = picker;
      cleanups.push(() => ref.remove());
    }
    if (picker.nextElementSibling !== anchor) anchor.before(picker);
    refreshPickerOptions();
  };

  const captureSend = () => {
    if (!isNewChatPage() || !pickerChoice) return;
    const prompt = getEditorText();
    if (!prompt) return;
    pendingAssign = {
      choice: pickerChoice,
      prompt,
      at: Date.now(),
      // Chats that already existed when sending can't be the new one – this
      // prevents filing an old chat if the new one never got an id (e.g. a
      // temporary chat) and the user opens another chat afterwards.
      knownKeys: new Set(uniqueChats(getAllItems()).map((c) => c.key)),
    };
  };

  const bindSendDetection = () => {
    const onKeyDown = (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target && safeAll(document, SITE.editorSelector).some((ed) => ed.contains(target))) {
        captureSend();
      }
    };
    const onClick = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const button = target?.closest(SITE.sendSelector);
      if (button && !button.closest(`#${PICKER_ID}`)) captureSend();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);
    cleanups.push(
      () => document.removeEventListener("keydown", onKeyDown, true),
      () => document.removeEventListener("click", onClick, true),
    );
  };

  // Called once the new chat got its id (URL /app/<id>).
  const assignNewChat = async (key, pending) => {
    const item = findItemByKey(key);
    const chat = {
      key,
      title: (item && getChatInfo(item)?.title) || pending.prompt.slice(0, 60),
      href: safeChatHref(window.location.pathname),
    };

    let folder = null;
    if (pending.choice === AUTO) {
      if (!aiEnabled) return;
      toast("KI wählt einen Ordner …");
      const res = await askFolderSuggestion(pending.prompt);
      if (!res?.ok || !res.name) {
        toast(`Kein Ordner gewählt: ${res?.error || "keine Antwort"}`);
        return;
      }
      folder = findFolderByName(res.name) || createFolderOrWarn(res.name);
    } else if (pending.choice.startsWith(NEW_PREFIX)) {
      const name = pending.choice.slice(NEW_PREFIX.length);
      folder = findFolderByName(name) || createFolderOrWarn(name);
    } else {
      folder = state.folders.find((f) => f.id === pending.choice) || null;
    }
    if (!folder) return;

    moveChat(chat, folder.id);
    activeKey = keyFromLocation() === key ? key : activeKey;
    pickerChoice = "";
    pickerSuggestion = null;
    await commit();
    toast(`Chat in „${folder.name}“ einsortiert.`);
  };

  let lastUrl = window.location.href;
  const watchUrl = () => {
    if (window.location.href === lastUrl) return;
    const previousPath = new URL(lastUrl).pathname;
    lastUrl = window.location.href;
    const key = keyFromLocation();

    if (pendingAssign && Date.now() - pendingAssign.at > 3 * 60 * 1000) pendingAssign = null;
    if (key && pendingAssign) {
      const pending = pendingAssign;
      pendingAssign = null;
      // Only the chat created right from the new-chat page gets filed.
      const cameFromNewChat = SITE.newChatPathRe.test(previousPath);
      if (cameFromNewChat && !pending.knownKeys.has(key) && !storedKeys().has(key)) {
        assignNewChat(key, pending);
      }
    } else if (pendingAssign && !isNewChatPage()) {
      pendingAssign = null; // navigated elsewhere without a new chat id
    }

    setActive(key);
    mountPicker();
  };

  // ---------------------------------------------------------------------------
  // Periodic sync with the page
  // ---------------------------------------------------------------------------
  const ensure = () => {
    if (shutdownIfOrphaned()) return false;
    ensureStyles();
    applyTheme();
    const mounted = mountDropZone();
    syncNativeItems();
    mountPicker();
    if (titleChanged) {
      titleChanged = false;
      if (!editing) render();
      saveState();
    }
    return mounted;
  };

  // ---------------------------------------------------------------------------
  // Migration from the old HTML-based storage (v1/v2)
  // ---------------------------------------------------------------------------
  const migrateLegacy = (legacy) => {
    const html = typeof legacy === "string" ? legacy : legacy?.html;
    if (!html || typeof html !== "string") return null;

    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return null;

    const migrated = emptyState();
    const now = new Date().toISOString();

    root.querySelectorAll(".ga-folder").forEach((folderEl) => {
      migrated.folders.push({
        id: uid(),
        name: cleanText(folderEl.querySelector(".ga-folder-title")?.textContent) || "Neuer Folder",
        expanded: folderEl.dataset.expanded === "true",
        createdAt: now,
        updatedAt: now,
        chats: Array.from(folderEl.querySelectorAll(".ga-folder-content .conversation-items-container"))
          .map(getChatInfo)
          .filter(Boolean),
      });
    });

    Array.from(root.children)
      .filter(
        (child) =>
          SITE.legacyItemSelector &&
          child.matches(SITE.legacyItemSelector) &&
          !child.classList.contains("ga-folder"),
      )
      .forEach((child) => {
        const info = getChatInfo(child);
        if (info) migrated.looseChats.push(info);
      });

    return normalizeState(migrated);
  };

  // ---------------------------------------------------------------------------
  // Load + sync with storage / popup / background
  // ---------------------------------------------------------------------------
  const load = async () => {
    const data = await storageGet([STATE_KEY, SETTINGS_KEY, AI_FLAG_KEY, ...LEGACY_KEYS]);
    settings = normalizeSettings(data[SETTINGS_KEY]);
    aiEnabled = isAiFlagOn(data[AI_FLAG_KEY]);

    let needsSave = false;
    if (data[STATE_KEY]) {
      state = normalizeState(data[STATE_KEY]);
    } else {
      const migrated = migrateLegacy(data[LEGACY_KEYS[0]] || data[LEGACY_KEYS[1]]);
      state = migrated || emptyState();
      needsSave = !!migrated;
    }
    if (pruneExpiredFolders()) needsSave = true;

    const key = keyFromLocation();
    activeKey = key && storedKeys().has(key) ? key : null;

    render();
    syncNativeItems();
    if (needsSave) await saveState();
  };

  const bindStorageSync = () => {
    if (!selfAlive() || !chrome.storage?.onChanged) return;
    const listener = (changes, area) => {
      if (area !== "local") return;
      if (AI_FLAG_KEY in changes) {
        aiEnabled = isAiFlagOn(changes[AI_FLAG_KEY].newValue);
        refreshPickerOptions();
      }
      if (changes[SETTINGS_KEY]) {
        settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
        if (pruneExpiredFolders()) commit();
      }
      if (changes[STATE_KEY]) {
        const next = normalizeState(changes[STATE_KEY].newValue);
        const ownIndex = pendingSaves.indexOf(JSON.stringify(next));
        if (ownIndex !== -1) {
          pendingSaves = pendingSaves.slice(ownIndex + 1);
          return;
        }
        state = next;
        editing = null;
        render();
        syncNativeItems();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    cleanups.push(() => {
      try {
        chrome.storage.onChanged.removeListener(listener);
      } catch {
        // context gone
      }
    });
  };

  const bindMessages = () => {
    if (!selfAlive() || !chrome.runtime?.onMessage) return;
    const listener = (msg, _sender, sendResponse) => {
      if (!msg || typeof msg.type !== "string") return;
      switch (msg.type) {
        case "ga:ping":
          sendResponse({ ok: true });
          return;
        case "ga:refresh": {
          const mounted = ensure();
          sendResponse({ ok: true, site: SITE.id, mounted, nativeCount: getSidebarItems().length });
          return;
        }
        case "ga:get-chats":
          ensure();
          // Sidebar + search page results (whatever Gemini has loaded).
          sendResponse({ ok: true, site: SITE.id, chats: uniqueChats([...getSidebarItems(), ...getAllItems()]) });
          return;
        default:
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    cleanups.push(() => {
      try {
        chrome.runtime.onMessage.removeListener(listener);
      } catch {
        // context gone
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  let ensureQueued = false;
  const queueEnsure = () => {
    if (ensureQueued) return;
    ensureQueued = true;
    window.setTimeout(() => {
      ensureQueued = false;
      ensure();
    }, 200);
  };

  const boot = async () => {
    bindMessages();
    bindStorageSync();
    bindNativeDrag();
    bindSendDetection();
    ensureStyles();
    await load();
    ensure();
    console.info(
      LOG,
      `aktiv auf ${SITE.label} – ${getSidebarItems().length} Chats in der Seitenleiste erkannt,`,
      `${state.folders.length} Ordner geladen.`,
    );

    // Gemini is an SPA that re-renders the sidebar and lazy-loads chats.
    const observer = new MutationObserver(queueEnsure);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const urlTimer = window.setInterval(watchUrl, 400);
    const pruneTimer = window.setInterval(() => {
      if (pruneExpiredFolders()) commit();
    }, 60 * 60 * 1000);
    cleanups.push(
      () => observer.disconnect(),
      () => window.clearInterval(urlTimer),
      () => window.clearInterval(pruneTimer),
    );
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
