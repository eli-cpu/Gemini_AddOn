export const createCollapsibleFolder = () => {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";
  const ITEM_CLASS = "conversation-items-container";
  const STYLE_ID = "gemini-folder-collapsible-style";

  const dropZone = document.getElementById(DROP_ZONE_ID);
  if (!dropZone) return "missing-dropzone";

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${DROP_ZONE_ID} .ga-folder {
        padding: 0 !important;
        overflow: hidden;
      }

      #${DROP_ZONE_ID} .ga-folder-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: pointer;
        user-select: none;
      }

      #${DROP_ZONE_ID} .ga-folder-title,
      #${DROP_ZONE_ID} .ga-folder-chevron {
        color: #fff !important;
      }

      #${DROP_ZONE_ID} .ga-folder-content {
        display: none;
        padding: 0 10px 10px 18px;
      }

      #${DROP_ZONE_ID} .ga-folder[data-expanded="true"] .ga-folder-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
    `;
    document.head.appendChild(style);
  }

  const raw = window.prompt("Folder-Name:", "Neuer Folder");
  if (raw === null) return "cancelled";
  const folderName = raw.trim() || "Neuer Folder";

  const folder = document.createElement("div");
  folder.className = `${ITEM_CLASS} ga-folder-item ga-folder`;
  folder.dataset.expanded = "false";
  folder.setAttribute("draggable", "false");

  const header = document.createElement("div");
  header.className = "ga-folder-header";

  const title = document.createElement("span");
  title.className = "ga-folder-title";
  title.textContent = folderName;

  const chevron = document.createElement("span");
  chevron.className = "ga-folder-chevron";
  chevron.textContent = ">";

  const content = document.createElement("div");
  content.className = "ga-folder-content";

  header.append(title, chevron);
  folder.append(header, content);

  header.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const expanded = folder.dataset.expanded === "true";
    folder.dataset.expanded = expanded ? "false" : "true";
    chevron.textContent = expanded ? ">" : "⌄";
  });

  const moveChatIntoFolder = (draggedId) => {
    if (!draggedId) return;
    const draggedEl = document.getElementById(draggedId);
    if (!draggedEl || draggedEl === folder) return;
    if (draggedEl.classList.contains("ga-folder")) return;

    folder.dataset.expanded = "true";
    chevron.textContent = "⌄";
    draggedEl.classList.remove("ga-folder-active");
    content.appendChild(draggedEl);
  };

  const handleFolderDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  };

  const handleFolderDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    moveChatIntoFolder(e.dataTransfer?.getData("text/plain"));
  };

  folder.addEventListener("dragover", handleFolderDragOver);
  folder.addEventListener("drop", handleFolderDrop);
  header.addEventListener("dragover", handleFolderDragOver);
  header.addEventListener("drop", handleFolderDrop);
  content.addEventListener("dragover", handleFolderDragOver);
  content.addEventListener("drop", handleFolderDrop);

  const heading = dropZone.querySelector(".ga-folder-heading");
  if (heading?.nextSibling) dropZone.insertBefore(folder, heading.nextSibling);
  else dropZone.appendChild(folder);

  return "created";
};
