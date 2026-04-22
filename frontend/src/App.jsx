import { useEffect, useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";
import { inject } from "./scripts/testInjection";
import { createFolderSpace } from "./scripts/injectFolder";

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
            const DROP_ZONE_ID = "gemini-folder-drop-zone";
            const ITEM_CLASS = "conversation-items-container";

            const anchor = document.querySelector(".gems-list-container");
            let dropZone = document.getElementById(DROP_ZONE_ID);

            if (!dropZone) {
              dropZone = document.createElement("div");
              dropZone.id = DROP_ZONE_ID;
              dropZone.style.cssText = `
                min-height: 120px;
                margin: 12px 0;
                padding: 12px;
                border: 1px dashed #555;
                border-radius: 10px;
                background: #2a2a2e;
                color: #e0e0e0;
                font-size: 13px;
              `;
              dropZone.textContent = "Ordnerbereich (hier hineinziehen)";
              if (anchor) anchor.after(dropZone);
              else document.body.appendChild(dropZone);
            }

            if (!dropZone.dataset.gaDropBound) {
              dropZone.dataset.gaDropBound = "1";
              dropZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                dropZone.style.borderColor = "#7aa2ff";
              });
              dropZone.addEventListener("dragleave", () => {
                dropZone.style.borderColor = "#555";
              });
              dropZone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropZone.style.borderColor = "#555";
                const draggedId = e.dataTransfer?.getData("text/plain");
                if (!draggedId) return;
                const draggedEl = document.getElementById(draggedId);
                if (draggedEl) dropZone.appendChild(draggedEl); // bleibt im Bereich
              });
            }

            const items = Array.from(
              document.querySelectorAll(`.${ITEM_CLASS}`),
            );
            if (!items.length) return "no-items";

            items.forEach((item, idx) => {
              if (!item.id) item.id = `ga-draggable-${Date.now()}-${idx}`;
              item.setAttribute("draggable", "true");

              if (!item.dataset.gaDragBound) {
                item.dataset.gaDragBound = "1";
                item.addEventListener("dragstart", (e) => {
                  e.dataTransfer?.setData("text/plain", item.id);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                });
              }
            });

            return "enabled";
          },
        });

        if (result === "enabled") setStatus("Drag & Drop aktiviert.");
        else if (result === "no-items")
          setStatus("Keine .conversation-items-container gefunden.");
        else setStatus("Unbekannter Rückgabewert.");
        return;
      } catch (err) {
        setStatus(`Injection-Fehler: ${err?.message || err}`);
        return;
      }
    }

    setStatus("Chrome Extension APIs nicht verfügbar.");
  };

  const handleFolderSpaceInjection = async () => {
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
          func: createFolderSpace,
        });

        if (result === "inserted")
          setStatus("FolderSpaceInjection: eingefügt.");
        else if (result === "removed")
          setStatus("FolderSpaceInjection: entfernt.");
        else
          setStatus(
            "FolderSpaceInjection: .gems-list-container nicht gefunden.",
          );
        return;
      } catch (err) {
        setStatus(`Injection-Fehler: ${err?.message || err}`);
        return;
      }
    }

    // Fallback ohne Extension APIs
    const result = createFolderSpace(document, { toggle: true });
    if (result === "inserted") setStatus("FolderSpaceInjection: eingefügt.");
    else if (result === "removed") setStatus("FolderSpaceInjection: entfernt.");
    else if (result === "exists")
      setStatus("FolderSpaceInjection: bereits vorhanden.");
    else
      setStatus("FolderSpaceInjection: .gems-list-container nicht gefunden.");
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
