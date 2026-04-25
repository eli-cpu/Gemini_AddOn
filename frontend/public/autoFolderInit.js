(() => {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";

  const ensureFolderArea = () => {
    const anchor = document.querySelector(".gems-list-container");
    if (!anchor) return false;

    let dropZone = document.getElementById(DROP_ZONE_ID);
    if (dropZone) return true;

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
    return true;
  };

  ensureFolderArea();

  const observer = new MutationObserver(() => {
    ensureFolderArea();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(() => observer.disconnect(), 60000);
})();
