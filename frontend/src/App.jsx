import { useEffect, useState } from "react";
import "./App.css";
import SortPage from "./pages/sortPage";
import AddFolderPage from "./pages/addFolderPage";
import SettingsPage from "./pages/settingsPage";
import ApiKeyPage from "./pages/apiKeyPage";
import { Icon, Status } from "./components/ui";
import { getActiveGeminiTab, hasExtensionApis, sendToTab } from "./lib/tabs";
import { createFolderIn, loadSettings, maskApiKey, updateState } from "./lib/storage";
import { useApiKey } from "./lib/useApiKey";

// Drag & drop is always on: the content script runs on every Gemini page.
// Opening the popup additionally makes sure it is injected into the active
// tab (e.g. tabs that were open before the extension was installed).
async function connectActiveTab() {
  if (!hasExtensionApis()) return { state: "error", text: "Nur in der Extension verfügbar" };
  try {
    const tab = await getActiveGeminiTab();
    const res = await sendToTab(tab.id, { type: "ga:refresh" });
    if (!res?.mounted) return { state: "idle", text: "Seitenleiste in Gemini öffnen" };
    return { state: "active", text: `Aktiv · ${res.nativeCount} Chats erkannt` };
  } catch {
    return { state: "idle", text: "Öffne gemini.google.com" };
  }
}

// AI entries only appear when a key is saved; otherwise a single
// "KI aktivieren" entry leads to the key page.
const buildMenu = (apiKey) => [
  ...(apiKey
    ? [{ page: "sort", icon: "sparkle", title: "KI-Sortierung", desc: "Chats automatisch in Ordner einsortieren" }]
    : []),
  { page: "addFolder", icon: "folder", title: "Ordner verwalten", desc: "Umbenennen, löschen, Chats entfernen" },
  { page: "settings", icon: "settings", title: "Einstellungen", desc: "Ordner-Limit und automatisches Löschen" },
  apiKey
    ? { page: "apiKey", icon: "key", title: "KI & API-Key", desc: `Aktiv · ${maskApiKey(apiKey)}` }
    : {
        page: "apiKey",
        icon: "key",
        title: "KI aktivieren",
        desc: "Gemini-API-Key eingeben",
        cta: true,
      },
];

function App() {
  const [page, setPage] = useState("home");
  const { loaded: keyLoaded, apiKey, hasKey } = useApiKey();
  const [connection, setConnection] = useState({ state: "idle", text: "Verbinde …" });
  const [folderName, setFolderName] = useState("");
  const [status, setStatus] = useState({ text: "", tone: "neutral" });

  useEffect(() => {
    let cancelled = false;
    connectActiveTab().then((c) => !cancelled && setConnection(c));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    try {
      const settings = await loadSettings();
      const result = await updateState((state) =>
        createFolderIn(state, folderName, settings.maxFolders),
      );
      if (!result.ok) {
        setStatus({ text: `Maximal ${settings.maxFolders} Ordner erlaubt.`, tone: "error" });
        return;
      }
      setFolderName("");
      setStatus({ text: `Ordner „${result.folder.name}“ erstellt.`, tone: "success" });
    } catch (err) {
      setStatus({ text: err?.message || String(err), tone: "error" });
    }
  };

  const back = () => {
    setStatus({ text: "", tone: "neutral" });
    setPage("home");
  };

  // The sort page is an AI feature – never show it without a key.
  const currentPage = page === "sort" && keyLoaded && !hasKey ? "home" : page;

  return (
    <main className="popup">
      {currentPage === "home" && (
        <>
          <header className="app-header">
            <img className="app-logo" src="/icons/icon48.png" alt="" />
            <div>
              <h1>Gemini AddOn</h1>
              <span className="chip" data-state={connection.state}>
                {connection.text}
              </span>
            </div>
          </header>

          <form className="create-row" onSubmit={handleCreateFolder}>
            <label className="visually-hidden" htmlFor="folder-name">
              Ordnername
            </label>
            <input
              id="folder-name"
              className="input"
              placeholder="Neuer Ordner"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              maxLength={80}
            />
            <button className="btn btn-primary" type="submit">
              <Icon name="add" size={18} />
              Erstellen
            </button>
          </form>
          <Status tone={status.tone}>{status.text}</Status>

          <nav className="menu" aria-label="Bereiche">
            {keyLoaded && buildMenu(apiKey).map((item) => (
              <button
                key={item.page}
                className={`menu-item ${item.cta ? "menu-cta" : ""}`.trim()}
                onClick={() => setPage(item.page)}
              >
                <span className="menu-icon">
                  <Icon name={item.icon} size={20} />
                </span>
                <span className="menu-text">
                  <span className="menu-title">{item.title}</span>
                  <span className="muted">{item.desc}</span>
                </span>
                <Icon name="chevron" size={20} />
              </button>
            ))}
          </nav>

          <p className="tip">
            <Icon name="drag" size={16} />
            <span>
              Chats in der Gemini-Seitenleiste einfach auf „Folders“ oder einen
              Ordner ziehen.
            </span>
          </p>
        </>
      )}

      {currentPage === "sort" && <SortPage onBack={back} />}
      {currentPage === "addFolder" && <AddFolderPage onBack={back} />}
      {currentPage === "settings" && <SettingsPage onBack={back} />}
      {currentPage === "apiKey" && <ApiKeyPage apiKey={apiKey} onBack={back} />}
    </main>
  );
}

export default App;
