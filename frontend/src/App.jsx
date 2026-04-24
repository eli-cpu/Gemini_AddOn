import { useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";
import { createFolderSpace } from "./scripts/injectFolder";
import { enableFolderDragDrop } from "./scripts/folderDragDrop";
import { executeInActiveTab } from "./scripts/executeInActiveTab";

function App() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState("home");

  const handleTestInjection = async () => {
    try {
      const result = await executeInActiveTab(enableFolderDragDrop);

      if (result === "enabled") setStatus("Drag & Drop aktiviert.");
      else if (result === "no-items")
        setStatus("Keine .conversation-items-container gefunden.");
      else setStatus("Unbekannter Rückgabewert.");
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
      if (result === "inserted")
        setStatus("FolderSpaceInjection: eingefügt.");
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
