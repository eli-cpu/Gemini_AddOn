export const ensureFolderAreaInPage = () => {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";
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
  heading.textContent = "Folders";
  dropZone.appendChild(heading);

  anchor.after(dropZone);
  return "inserted";
};
