import { useEffect, useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";

function App() {
  const [maxFolders, setMaxFolders] = useState("");
  const [deleteOlderThan, setDeleteOlderThan] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState("home");

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["maxFolders", "deleteOlderThan"], (data) => {
        if (data.maxFolders) setMaxFolders(String(data.maxFolders));
        if (data.deleteOlderThan) setDeleteOlderThan(data.deleteOlderThan);
      });
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("");

    const payload = {
      maxFolders: Number(maxFolders),
      deleteOlderThan,
    };

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set(payload, () => setStatus("Gespeichert."));
      return;
    }

    console.log("Settings:", payload);
    setStatus("Gespeichert (ohne chrome.storage).");
  };

  return (
    <main className="popup">
      <section className="card">
        {page === "home" && (
          <>
            <h1>Ordner-Bereinigung</h1>
            <p className="subline">Konfiguriere die automatische Löschung</p>

            <form onSubmit={handleSubmit} className="form">
              <label className="field">
                <span>A) Maximale Menge an Ordnern</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={maxFolders}
                  onChange={(e) => setMaxFolders(e.target.value)}
                  placeholder="z. B. 50"
                />
              </label>

              <label className="field">
                <span>
                  B) Maximale Anzahl an Chats, die übrig bleiben sollen
                </span>
                <input
                  type="number"
                  min="1"
                  required
                  value={deleteOlderThan}
                  onChange={(e) => setDeleteOlderThan(e.target.value)}
                />
              </label>

              <button className="counter" type="submit">
                Speichern
              </button>
            </form>

            <button className="counter" onClick={() => setPage("sort")}>
              Zur Sortier-Seite
            </button>

            <button className="counter" onClick={() => setPage("addFolder")}>
              Zur Ordner-/DOM-Seite
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
