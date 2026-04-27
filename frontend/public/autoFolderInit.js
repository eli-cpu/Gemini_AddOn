(() => {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";
  const STORAGE_KEY_V2 = "ga_folders_state_v2";
  const STORAGE_KEY_LEGACY = "ga_folders_html_v1";
  const HYDRATE_DELAY_MS = 1800;

  const storageGet = (keys) =>
    new Promise((resolve) => {
      chrome.storage?.local?.get(keys, (result) => resolve(result || {}));
    });

  const storageSet = (data) =>
    new Promise((resolve) => {
      chrome.storage?.local?.set(data, () => resolve());
    });

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

  const createHeading = () => {
    const heading = document.createElement("div");
    heading.className = "ga-folder-heading";
    heading.style.cssText = `
      margin: 0 0 4px 2px;
      font-size: 13px;
      font-weight: 600;
      color: #e0e0e0;
    `;
    heading.textContent = "Folders";
    return heading;
  };

  const createDropZone = () => {
    const dropZone = document.createElement("div");
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
    dropZone.appendChild(createHeading());
    return dropZone;
  };

  const serializeDropZone = (dropZone) => {
    const clone = dropZone.cloneNode(true);
    const heading = clone.querySelector(".ga-folder-heading");
    if (heading) heading.remove();
    return clone.innerHTML;
  };

  const saveDropZone = async (dropZone) => {
    const saved = await storageGet([STORAGE_KEY_V2, STORAGE_KEY_LEGACY]);
    const currentState = normalizeState(
      saved?.[STORAGE_KEY_V2] || saved?.[STORAGE_KEY_LEGACY],
    );
    const html = serializeDropZone(dropZone);

    const nextState = {
      html,
      folders: currentState.folders,
      sort: currentState.sort,
      updatedAt: new Date().toISOString(),
    };

    await storageSet({
      [STORAGE_KEY_V2]: nextState,
      [STORAGE_KEY_LEGACY]: html,
    });
  };

  const restoreDropZone = async (dropZone) => {
    const result = await storageGet([STORAGE_KEY_V2, STORAGE_KEY_LEGACY]);
    const state = normalizeState(
      result?.[STORAGE_KEY_V2] || result?.[STORAGE_KEY_LEGACY],
    );
    const savedHtml = state.html;

    if (!savedHtml || typeof savedHtml !== "string") return false;

    const temp = document.createElement("div");
    temp.innerHTML = savedHtml;

    const nodes = Array.from(temp.childNodes).filter(
      (node) =>
        !(
          node.nodeType === Node.ELEMENT_NODE &&
          node.classList.contains("ga-folder-heading")
        ),
    );

    const heading =
      dropZone.querySelector(".ga-folder-heading") || createHeading();
    dropZone.replaceChildren(heading, ...nodes);
    return true;
  };

  const bindPersistence = (dropZone) => {
    if (dropZone.dataset.gaPersistenceBound === "1") return;
    dropZone.dataset.gaPersistenceBound = "1";

    const startedAt = Date.now();
    let saveTimer = null;

    const queueSave = () => {
      if (Date.now() - startedAt < HYDRATE_DELAY_MS) return;

      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => saveDropZone(dropZone), 250);
    };

    const observer = new MutationObserver(() => queueSave());
    observer.observe(dropZone, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });

    dropZone.addEventListener("drop", queueSave, true);
    dropZone.addEventListener("input", queueSave, true);
    dropZone.addEventListener("click", queueSave, true);
    window.addEventListener("beforeunload", () => saveDropZone(dropZone));
  };

  const ensureFolderArea = async () => {
    const anchor = document.querySelector(".gems-list-container");
    if (!anchor) return false;

    let dropZone = document.getElementById(DROP_ZONE_ID);

    if (!dropZone) {
      dropZone = createDropZone();
      anchor.after(dropZone);
    } else if (!dropZone.querySelector(".ga-folder-heading")) {
      dropZone.prepend(createHeading());
    }

    if (dropZone.dataset.gaRestored !== "1") {
      await restoreDropZone(dropZone);
      dropZone.dataset.gaRestored = "1";
    }

    bindPersistence(dropZone);
    return true;
  };

  const boot = () => {
    ensureFolderArea();

    const observer = new MutationObserver(() => {
      ensureFolderArea();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 60000);
  };

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(boot, 0);
  } else {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  }

  window.addEventListener(
    "load",
    () => {
      setTimeout(ensureFolderArea, 250);
    },
    { once: true },
  );
})();
