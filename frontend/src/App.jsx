import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [maxFolders, setMaxFolders] = useState("");
  const [deleteOlderThan, setDeleteOlderThan] = useState("");
  const [status, setStatus] = useState("");

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
      chrome.storage.local.set(payload, () => {
        setStatus("Gespeichert.");
      });
      return;
    }

    console.log("Settings:", payload);
    setStatus("Gespeichert (ohne chrome.storage).");
  };

  return (
    <main className="popup">
      <section className="card">
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
            <span>B) Löschen, wenn älter als (Datum)</span>
            <input
              type="date"
              required
              value={deleteOlderThan}
              onChange={(e) => setDeleteOlderThan(e.target.value)}
            />
          </label>

          <button className="counter" type="submit">
            Speichern
          </button>
        </form>

        {status && <p className="status">{status}</p>}
      </section>
    </main>
  );
}

export default App;
