import { useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";
import { enableFolderDragDrop } from "./scripts/folderDragDrop";
import { executeInActiveTab } from "./scripts/executeInActiveTab";
import { bindFolderOutsideActiveSync } from "./scripts/bindFolderOutsideActiveSync";
import { createCollapsibleFolder } from "./scripts/createCollapsibleFolder";

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

  const handleCreateFolder = async () => {
    try {
      const result = await executeInActiveTab(createCollapsibleFolder);
      if (result === "created") setStatus("Folder erstellt.");
      else if (result === "missing-dropzone")
        setStatus("Bitte zuerst 'Drag & Drop aktivieren'.");
      else if (result === "cancelled") setStatus("Erstellung abgebrochen.");
      else setStatus("Folder konnte nicht erstellt werden.");
    } catch (err) {
      setStatus(err?.message || `Injection-Fehler: ${err}`);
    }
  };

  return (
    <main className="popup">
      <section className="card">
        {page === "home" && (
          <>
            {/*
            <button className="counter" onClick={() => setPage("sort")}>
              Zur Sortier-Seite
            </button>

            <button className="counter" onClick={() => setPage("addFolder")}>
              Zur Ordner-/DOM-Seite
            </button>

            <button className="counter" onClick={handleTestInjection}>
              Drag & Drop aktivieren
            </button>*/}

            <button className="counter" onClick={handleCreateFolder}>
              Create Folder
            </button>

            <p className="status">
              Auto: Folderbereich wird per Content Script beim Laden erstellt
              (Tab neu laden).
            </p>
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
