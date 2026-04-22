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

                #${DROP_ZONE_ID}.ga-drop-active {
                  border-color: #7aa2ff;
                }

                #${DROP_ZONE_ID} .ga-folder-heading {
                  margin: 0 0 4px 2px;
                  font-size: 13px;
                  font-weight: 600;
                  color: #e0e0e0;
                }

                /* Design wie im Beispiel */
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

                /* NEU: gesamte Textfarbe im Item immer weiß */
                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item,
                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item * {
                  color: #ffffff !important;
                }

                /* NEU: Link-Farben nicht pink/blau */
                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a,
                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a:visited,
                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a:hover,
                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item a:active {
                  color: #ffffff !important;
                  text-decoration: none !important;
                }

                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item:hover {
                  background-color: #555555 !important;
                }

                #${DROP_ZONE_ID} .${ITEM_CLASS}.ga-folder-item.ga-folder-active {
                  background-color: #2b4570 !important;
                }

                #${DROP_ZONE_ID} .${ITEM_CLASS}[data-ga-dragging="true"] {
                  opacity: 0.65;
                }
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
                .querySelectorAll(
                  `.${ITEM_CLASS}.ga-folder-item.ga-folder-active`,
                )
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
                    e.target instanceof Element
                      ? e.target
                      : e.target?.parentElement;
                  if (!target) return;

                  const item = target.closest(`.${ITEM_CLASS}.ga-folder-item`);
                  if (!item || !dropZone.contains(item)) return;

                  // 1) immer active setzen (auch bei Text-Klick)
                  setActiveItem(item);

                  // 2) wenn nicht direkt auf Link/Button geklickt wurde:
                  //    inneren Chat-Trigger auslösen
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

            const items = Array.from(
              document.querySelectorAll(`.${ITEM_CLASS}`),
            );
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
