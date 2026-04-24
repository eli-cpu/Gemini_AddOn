export function enableFolderDragDrop() {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";
  const ITEM_CLASS = "conversation-items-container";
  const STYLE_ID = "gemini-folder-dnd-style";

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${DROP_ZONE_ID} {
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
      }

      #${DROP_ZONE_ID}.ga-drop-active { border-color: #7aa2ff; }

      #${DROP_ZONE_ID} .ga-folder-heading {
        margin: 0 0 4px 2px;
        font-size: 13px;
        font-weight: 600;
        color: #e0e0e0;
      }

      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item {
        padding: 12px 16px !important;
        border-radius: 25px !important;
        cursor: pointer;
        color: #fff !important;
        background-color: #333333 !important;
        transition: background-color 0.2s ease;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item,
      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item * { color: #ffffff !important; }

      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a,
      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a:visited,
      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a:hover,
      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a:active {
        color: #ffffff !important;
        text-decoration: none !important;
      }

      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item:hover { background-color: #555555 !important; }
      #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item.ga-folder-active { background-color: #2b4570 !important; }
      #${DROP_ZONE_ID} .${ITEM_CLASS}[data-ga-dragging="true"] { opacity: 0.65; }
    `;
    document.head.appendChild(style);
  }

  const anchor = document.querySelector(".gems-list-container");
  let dropZone = document.getElementById(DROP_ZONE_ID);

  if (!dropZone) {
    dropZone = document.createElement("div");
    dropZone.id = DROP_ZONE_ID;

    const heading = document.createElement("div");
    heading.className = "ga-folder-heading";
    heading.textContent = "Folders";
    dropZone.appendChild(heading);

    if (anchor) anchor.after(dropZone);
    else document.body.appendChild(dropZone);
  }

  const setActiveItem = (item) => {
    dropZone
      .querySelectorAll(`.${ITEM_CLASS}.ga-folder-item.ga-folder-active`)
      .forEach((el) => el.classList.remove("ga-folder-active"));
    item.classList.add("ga-folder-active");
  };

  const getClickableInItem = (item) =>
    item.querySelector('a[href], button, [role="link"]');

  if (!dropZone.dataset.gaClickBound) {
    dropZone.dataset.gaClickBound = "1";
    dropZone.addEventListener(
      "click",
      (e) => {
        const target =
          e.target instanceof Element ? e.target : e.target?.parentElement;
        if (!target) return;

        const item = target.closest(`.${ITEM_CLASS}.ga-folder-item`);
        if (!item || !dropZone.contains(item)) return;

        setActiveItem(item);

        const clickedInteractive = target.closest(
          'a[href], button, [role="link"]',
        );
        if (!clickedInteractive) {
          const clickable = getClickableInItem(item);
          if (clickable) clickable.click();
        }
      },
      true,
    );
  }

  if (!dropZone.dataset.gaDropBound) {
    dropZone.dataset.gaDropBound = "1";

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      dropZone.classList.add("ga-drop-active");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("ga-drop-active");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("ga-drop-active");

      const draggedId = e.dataTransfer?.getData("text/plain");
      if (!draggedId) return;

      const draggedEl = document.getElementById(draggedId);
      if (!draggedEl) return;

      draggedEl.dataset.gaDragging = "false";
      draggedEl.classList.add("ga-folder-item");
      dropZone.appendChild(draggedEl);
      setActiveItem(draggedEl);
    });
  }

  const items = Array.from(document.querySelectorAll(`.${ITEM_CLASS}`));
  if (!items.length) return "no-items";

  items.forEach((item, idx) => {
    if (!item.id) item.id = `ga-draggable-${Date.now()}-${idx}`;
    item.setAttribute("draggable", "true");

    if (dropZone.contains(item)) item.classList.add("ga-folder-item");

    if (!item.dataset.gaDragBound) {
      item.dataset.gaDragBound = "1";
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", item.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        item.dataset.gaDragging = "true";
      });
      item.addEventListener("dragend", () => {
        item.dataset.gaDragging = "false";
      });
    }
  });

  return "enabled";
}
