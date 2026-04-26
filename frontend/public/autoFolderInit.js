(() => {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";
  const STORAGE_KEY = "ga_folders_html_v1";

  const serializeDropZone = (dropZone) => {
    const clone = dropZone.cloneNode(true);
    const heading = clone.querySelector(".ga-folder-heading");
    if (heading) heading.remove();
    return clone.innerHTML;
  };

  const saveDropZone = (dropZone) => {
    const html = serializeDropZone(dropZone);
    chrome.storage?.local?.set({ [STORAGE_KEY]: html });
  };

  const restoreDropZone = (dropZone) =>
    new Promise((resolve) => {
      chrome.storage?.local?.get([STORAGE_KEY], (result) => {
        const savedHtml = result?.[STORAGE_KEY];
        if (!savedHtml || typeof savedHtml !== "string") return resolve(false);

        dropZone.innerHTML = savedHtml;
        Array.from(dropZone.children).forEach((child) => {
          if (!child.classList?.contains("ga-folder-heading")) child.remove();
        });

        const temp = document.createElement("div");
        temp.innerHTML = savedHtml;
        while (temp.firstChild) dropZone.appendChild(temp.firstChild);

        resolve(true);
      });
    });

  const bindPersistence = (dropZone) => {
    if (dropZone.dataset.gaPersistenceBound === "1") return;
    dropZone.dataset.gaPersistenceBound = "1";

    let saveTimer = null;
    const queueSave = () => {
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
    }

    if (dropZone.dataset.gaRestored !== "1") {
      await restoreDropZone(dropZone);
      dropZone.dataset.gaRestored = "1";
    }

    bindPersistence(dropZone);
    return true;
  };

  ensureFolderArea();

  const observer = new MutationObserver(() => {
    ensureFolderArea();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  setTimeout(() => observer.disconnect(), 60000);
})();
