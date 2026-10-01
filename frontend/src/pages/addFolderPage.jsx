import { useEffect, useState } from "react";
import {
  loadState,
  normalizeState,
  removeChatEverywhere,
  stateKeyFor,
  updateState,
} from "../lib/storage";
import { siteLabel } from "../lib/sites";
import { Icon, IconButton, PageHeader, SiteSwitch, Status } from "../components/ui";
import { useConfirm } from "../components/useConfirm";

// Ordner-Verwaltung: rename/delete folders and remove chats from them.
// Shows the folders of one site (remounted via `key` when the site changes).
// Changes go to chrome.storage; open tabs of that site re-render automatically.
function AddFolderPage({ site, onSiteChange, activeSite, onBack }) {
  const hasStorage = typeof chrome !== "undefined" && !!chrome.storage?.onChanged;
  const [state, setState] = useState(null);
  const [status, setStatus] = useState({
    text: hasStorage ? "" : "Nur in der Extension verfügbar.",
    tone: "error",
  });
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    if (!hasStorage) return undefined;
    const key = stateKeyFor(site);
    loadState(site).then(setState);
    const onChanged = (changes, area) => {
      if (area === "local" && changes[key]) {
        setState(normalizeState(changes[key].newValue));
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [hasStorage, site]);

  const run = async (mutator, text) => {
    try {
      await updateState(mutator, site);
      if (text) setStatus({ text, tone: "success" });
    } catch (err) {
      setStatus({ text: err?.message || String(err), tone: "error" });
    }
  };

  const toggleOpen = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startRename = (folder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const submitRename = (e, folder) => {
    e?.preventDefault();
    if (editingId !== folder.id) return;
    const name = editName.trim();
    setEditingId(null);
    if (!name || name === folder.name) return;
    run((s) => {
      const target = s.folders.find((f) => f.id === folder.id);
      if (target) {
        target.name = name;
        target.updatedAt = new Date().toISOString();
      }
    }, "Ordner umbenannt.");
  };

  const deleteFolder = async (folder) => {
    const ok = await confirm({
      title: `„${folder.name}“ löschen?`,
      message: "Die Chats bleiben in Gemini erhalten und erscheinen wieder in der normalen Liste.",
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    run((s) => {
      s.folders = s.folders.filter((f) => f.id !== folder.id);
    }, `Ordner „${folder.name}“ gelöscht.`);
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: "Alle Ordner löschen?",
      message: "Die Chats bleiben in Gemini erhalten und erscheinen wieder in der normalen Liste.",
      confirmLabel: "Alle löschen",
      danger: true,
    });
    if (!ok) return;
    run((s) => {
      s.folders = [];
      s.looseChats = [];
    }, "Alle Ordner gelöscht.");
  };

  const removeChat = (key) => run((s) => removeChatEverywhere(s, key), "Chat aus Ordner entfernt.");

  const folders = state?.folders || [];
  const looseCount = state?.looseChats.length || 0;

  return (
    <>
      <PageHeader
        title="Ordner verwalten"
        subtitle={
          state
            ? `${siteLabel(site)} · ${folders.length} Ordner${looseCount ? ` · ${looseCount} Chats ohne Ordner` : ""}`
            : undefined
        }
        onBack={onBack}
      />

      <SiteSwitch value={site} onChange={onSiteChange} activeSite={activeSite} />

      {state && folders.length === 0 && (
        <div className="empty">
          <Icon name="folder" size={32} />
          <span>Noch keine Ordner für {siteLabel(site)} vorhanden.</span>
        </div>
      )}

      <ul className="folder-list">
        {folders.map((folder) => {
          const open = openIds.has(folder.id);
          return (
            <li key={folder.id}>
              {editingId === folder.id ? (
                <form className="row rename-form" onSubmit={(e) => submitRename(e, folder)}>
                  <label className="visually-hidden" htmlFor={`n-${folder.id}`}>
                    Neuer Name für {folder.name}
                  </label>
                  <input
                    id={`n-${folder.id}`}
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => submitRename(null, folder)}
                    onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    maxLength={80}
                    autoFocus
                  />
                </form>
              ) : (
                <div className="row">
                  <button
                    type="button"
                    className="row-main"
                    aria-expanded={open}
                    onClick={() => toggleOpen(folder.id)}
                    title={folder.name}
                  >
                    <Icon name="chevron" size={18} className={`chevron ${open ? "open" : ""}`} />
                    <Icon name={open ? "folderOpen" : "folder"} size={18} className="folder-icon" />
                    <span className="row-label">{folder.name}</span>
                    <span className="count">{folder.chats.length}</span>
                  </button>
                  <span className="row-actions">
                    <IconButton icon="edit" label={`„${folder.name}“ umbenennen`} onClick={() => startRename(folder)} />
                    <IconButton
                      icon="delete"
                      label={`„${folder.name}“ löschen`}
                      className="danger"
                      onClick={() => deleteFolder(folder)}
                    />
                  </span>
                </div>
              )}

              {open && (
                <ul className="chat-list" aria-label={`Chats in ${folder.name}`}>
                  {folder.chats.length === 0 && <li className="muted">Leer</li>}
                  {folder.chats.map((chat) => (
                    <li key={chat.key} className="row">
                      <span className="row-label" title={chat.title}>
                        {chat.title}
                      </span>
                      <span className="row-actions">
                        <IconButton
                          icon="close"
                          label={`„${chat.title}“ aus Ordner entfernen`}
                          onClick={() => removeChat(chat.key)}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <Status tone={status.tone}>{status.text}</Status>

      {(folders.length > 0 || looseCount > 0) && (
        <div className="footer-actions">
          <button type="button" className="btn btn-danger" onClick={deleteAll}>
            <Icon name="delete" size={18} />
            Alle löschen
          </button>
        </div>
      )}

      {confirmDialog}
    </>
  );
}

export default AddFolderPage;
