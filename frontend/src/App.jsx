import { useEffect, useState } from "react";
import "./App.css";
import { getConversations } from "./scripts/getChats";

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
      chrome.storage.local.set(payload, () => setStatus("Gespeichert."));
      return;
    }

    console.log("Settings:", payload);
    setStatus("Gespeichert (ohne chrome.storage).");
  };

  const handleTestGetConversations = async () => {
    setStatus("");

    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.tabs?.query &&
        chrome.scripting?.executeScript
      ) {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab?.id) {
          setStatus("Kein aktiver Tab gefunden.");
          return;
        }

        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getConversations,
        });

        const conversations = result?.result || [];
        console.log("Conversations:", conversations);
        setStatus(`${conversations.length} Chats gefunden.`);
        return;
      }

      const conversations = getConversations();
      console.log("Conversations:", conversations);
      setStatus(`${conversations.length} Chats gefunden.`);
    } catch (error) {
      console.error(error);
      setStatus("Test fehlgeschlagen.");
    }
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
            <span>B) Maximale Anzahl an Chats, die übrig bleiben sollen</span>
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

        <button className="counter" onClick={handleTestGetConversations}>
          Test: getConversations
        </button>

        {status && <p className="status">{status}</p>}
      </section>
    </main>
  );
}

export default App;
