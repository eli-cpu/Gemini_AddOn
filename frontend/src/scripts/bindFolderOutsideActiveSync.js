export const bindFolderOutsideActiveSync = () => {
  const DROP_ZONE_ID = "gemini-folder-drop-zone";
  const ITEM_CLASS = "conversation-items-container";
  const ACTIVE_CLASS = "ga-folder-active";

  const dropZone = document.getElementById(DROP_ZONE_ID);
  if (!dropZone) return "missing-dropzone";

  const clearFolderActive = () => {
    dropZone
      .querySelectorAll(`.${ITEM_CLASS}.${ACTIVE_CLASS}`)
      .forEach((el) => el.classList.remove(ACTIVE_CLASS));
  };

  if (!document.body.dataset.gaFolderOutsideSyncBound) {
    document.body.dataset.gaFolderOutsideSyncBound = "1";

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;

        const clickedChat = target.closest(`.${ITEM_CLASS}`);
        if (!clickedChat) return;

        if (!dropZone.contains(clickedChat)) {
          clearFolderActive();
        }
      },
      true,
    );
  }

  return "bound";
};
