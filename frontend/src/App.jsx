import { useEffect, useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";
import { inject } from "./scripts/testInjection";

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

  const handleTestInjection = async () => {
    if (
      typeof chrome !== "undefined" &&
      chrome.tabs?.query &&
      chrome.scripting?.executeScript
    ) {
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!activeTab?.id) {
          setStatus("Kein aktiver Tab gefunden.");
          return;
        }

        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const id = "my-test-separator";
            const existing = document.getElementById(id);
            const container = document.querySelector(".gems-list-container");

            if (existing) {
              existing.remove();
              return "removed";
            }

            if (!container) return "missing-container";

            const myDiv = document.createElement("div");
            myDiv.id = id;
            myDiv.style.cssText = `
              padding: 15px;
              margin: 10px 0;
              text-align: center;
              border: 1px dashed #555;
              color: #aaa;
              font-size: 14px;
              border-radius: 8px;
              background: rgba(255,255,255,0.05);
            `;
            myDiv.innerText = "--- TESTBEREICH ---";
            container.after(myDiv);
            return "inserted";
          },
        });

        if (result === "inserted") setStatus("TestInjection: eingefügt.");
        else if (result === "removed") setStatus("TestInjection: entfernt.");
        else setStatus("TestInjection: .gems-list-container nicht gefunden.");
        return;
      } catch (err) {
        setStatus(`Injection-Fehler: ${err?.message || err}`);
        return;
      }
    }

    // Fallback ohne Extension APIs
    const result = inject(document, { toggle: true });
    if (result === "inserted") setStatus("TestInjection: eingefügt.");
    else if (result === "removed") setStatus("TestInjection: entfernt.");
    else if (result === "exists")
      setStatus("TestInjection: bereits vorhanden.");
    else setStatus("TestInjection: .gems-list-container nicht gefunden.");
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
              TestInjection
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
