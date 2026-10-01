import { useState } from "react";
import { getActiveChatTab } from "../lib/tabs";
import { siteLabel } from "../lib/sites";
import { Icon, PageHeader, Status } from "../components/ui";

// KI-Sortierung: the actual work happens in the background service worker
// so it keeps running if the popup closes.
function SortPage({ onBack }) {
  const [status, setStatus] = useState({ text: "", tone: "neutral" });
  const [busy, setBusy] = useState(false);
  const [onlyUnsorted, setOnlyUnsorted] = useState(true);
  const [maxChats, setMaxChats] = useState(100);

  const handleSort = async () => {
    setBusy(true);
    setStatus({ text: "Sortiere …", tone: "neutral" });
    try {
      const { tab, site } = await getActiveChatTab();
      setStatus({ text: `Sortiere deine ${siteLabel(site)}-Chats …`, tone: "neutral" });
      const result = await chrome.runtime.sendMessage({
        type: "ga:ai-sort",
        tabId: tab.id,
        options: { onlyUnsorted, maxChats: Number(maxChats) || 100 },
      });
      if (!result?.ok) throw new Error(result?.error || "Unbekannter Fehler.");
      setStatus({ text: result.message, tone: "success" });
    } catch (err) {
      setStatus({ text: err?.message || String(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="KI-Sortierung"
        subtitle="Chats im aktiven Gemini- oder ChatGPT-Tab einsortieren"
        onBack={onBack}
      />

      <div className="card">
        <label className="switch">
          <span>Nur Chats ohne Ordner</span>
          <input
            type="checkbox"
            checked={onlyUnsorted}
            onChange={(e) => setOnlyUnsorted(e.target.checked)}
          />
          <span className="switch-track" aria-hidden="true" />
        </label>

        <div className="field-row">
          <label htmlFor="max-chats">Maximal sortieren</label>
          <input
            id="max-chats"
            className="input number-input"
            type="number"
            min={1}
            max={500}
            value={maxChats}
            onChange={(e) => setMaxChats(e.target.value)}
          />
        </div>
      </div>

      <p className="tip">
        <Icon name="sparkle" size={16} />
        <span>
          Sortiert die Chats, die im aktiven Tab (Gemini oder ChatGPT) in der
          Seitenleiste geladen sind. Die Titel werden an die Gemini-API gesendet.
        </span>
      </p>

      {busy && <div className="progress" aria-hidden="true" />}

      <button className="btn btn-primary btn-block" onClick={handleSort} disabled={busy}>
        <Icon name="sparkle" size={18} />
        {busy ? "Sortiere …" : "Jetzt sortieren"}
      </button>

      <Status tone={status.tone}>{status.text}</Status>
    </>
  );
}

export default SortPage;
