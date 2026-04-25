import { useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";
import { createFolderSpace } from "./scripts/injectFolder";
import { enableFolderDragDrop } from "./scripts/folderDragDrop";
import { executeInActiveTab } from "./scripts/executeInActiveTab";

const bindFolderOutsideActiveSync = () => {
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

function App() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState("home");

  const handleTestInjection = async () => {
    try {
      const result = await executeInActiveTab(enableFolderDragDrop);

      if (result === "enabled") {
        await executeInActiveTab(bindFolderOutsideActiveSync);
        setStatus("Drag & Drop aktiviert.");
      } else if (result === "no-items") {
        setStatus("Keine .conversation-items-container gefunden.");
      } else {
        setStatus("Unbekannter Rückgabewert.");
      }
    } catch (err) {
      setStatus(err?.message || `Injection-Fehler: ${err}`);
    }
  };

  const handleFolderSpaceInjection = async () => {
    try {
      const result = await executeInActiveTab(createFolderSpace);

      if (result === "inserted") setStatus("FolderSpaceInjection: eingefügt.");
      else if (result === "removed")
        setStatus("FolderSpaceInjection: entfernt.");
      else
        setStatus("FolderSpaceInjection: .gems-list-container nicht gefunden.");
    } catch (err) {
      // Fallback ohne Extension APIs
      const result = createFolderSpace(document, { toggle: true });
      if (result === "inserted") setStatus("FolderSpaceInjection: eingefügt.");
      else if (result === "removed")
        setStatus("FolderSpaceInjection: entfernt.");
      else if (result === "exists")
        setStatus("FolderSpaceInjection: bereits vorhanden.");
      else
        setStatus("FolderSpaceInjection: .gems-list-container nicht gefunden.");
    }
  };

  return (
    <main className="popup">
      <section className="card">
        {page === "home" && (
          <>
            <button className="counter" onClick={() => setPage("sort")}>
              Zur Sortier-Seite
            </button>

            <button className="counter" onClick={() => setPage("addFolder")}>
              Zur Ordner-/DOM-Seite
            </button>

            <button className="counter" onClick={handleTestInjection}>
              Drag & Drop aktivieren
            </button>

            {status && <p className="status">{status}</p>}
          </>
        )}

        {page === "sort" && <SortPage onBack={() => setPage("home")} />}

        {page === "addFolder" && (
          <AddFolderPage onBack={() => setPage("home")} />
        )}
      </section>
    </main>
  );
}

export default App;
