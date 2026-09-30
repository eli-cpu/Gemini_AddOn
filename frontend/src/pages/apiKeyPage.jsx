import { useState } from "react";
import { maskApiKey, removeApiKey, saveApiKey } from "../lib/storage";
import { verifyApiKey } from "../lib/gemini";
import { Icon, IconButton, PageHeader, Status } from "../components/ui";
import { useConfirm } from "../components/useConfirm";

const AI_STUDIO_URL = "https://aistudio.google.com/apikey";

// Enter / replace / remove the Gemini API key. Without a key all AI
// features are hidden (popup + Gemini page).
function ApiKeyPage({ apiKey, onBack }) {
  const hasKey = !!apiKey;
  const [editing, setEditing] = useState(!hasKey);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ text: "", tone: "neutral" });
  const [confirm, confirmDialog] = useConfirm();

  const handleSave = async (e) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) {
      setStatus({ text: "Bitte einen API-Key eingeben.", tone: "error" });
      return;
    }
    setBusy(true);
    setStatus({ text: "Prüfe API-Key …", tone: "neutral" });
    try {
      await verifyApiKey(key);
      await saveApiKey(key);
      setValue("");
      setVisible(false);
      setEditing(false);
      setStatus({ text: "API-Key gespeichert. KI-Funktionen sind aktiv.", tone: "success" });
    } catch (err) {
      setStatus({ text: err?.message || String(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: "API-Key entfernen?",
      message: "KI-Sortierung, „Automatisch (KI)“ und Vorschläge werden ausgeblendet. Ordner bleiben erhalten.",
      confirmLabel: "Entfernen",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeApiKey();
      setEditing(true);
      setStatus({ text: "API-Key entfernt. KI-Funktionen sind ausgeschaltet.", tone: "success" });
    } catch (err) {
      setStatus({ text: err?.message || String(err), tone: "error" });
    }
  };

  return (
    <>
      <PageHeader
        title="KI & API-Key"
        subtitle={hasKey ? "KI-Funktionen sind aktiv" : "KI-Funktionen sind ausgeschaltet"}
        onBack={onBack}
      />

      {hasKey && !editing && (
        <div className="card">
          <div className="key-row">
            <span className="menu-icon">
              <Icon name="key" size={20} />
            </span>
            <span className="menu-text">
              <span className="menu-title">Gespeicherter Key</span>
              <span className="muted key-mask">{maskApiKey(apiKey)}</span>
            </span>
            <span className="chip" data-state="active">
              Aktiv
            </span>
          </div>
          <div className="button-row">
            <button type="button" className="btn btn-danger" onClick={handleRemove}>
              <Icon name="delete" size={18} />
              Entfernen
            </button>
            <button type="button" className="btn btn-tonal" onClick={() => setEditing(true)}>
              Ersetzen
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form className="card" onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="api-key">Gemini API-Key</label>
            <div className="input-with-action">
              <input
                id="api-key"
                className="input"
                type={visible ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                aria-describedby="api-key-hint"
              />
              <IconButton
                icon={visible ? "visibilityOff" : "visibility"}
                label={visible ? "Key verbergen" : "Key anzeigen"}
                onClick={() => setVisible((v) => !v)}
              />
            </div>
            <span id="api-key-hint" className="field-hint">
              Wird vor dem Speichern bei Google geprüft.
            </span>
          </div>

          <div className="button-row">
            {hasKey && (
              <button type="button" className="btn btn-text" onClick={() => setEditing(false)}>
                Abbrechen
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Prüfe …" : "Speichern"}
            </button>
          </div>

          <a className="link" href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer">
            Kostenlosen Key in Google AI Studio erstellen
            <Icon name="openInNew" size={16} />
          </a>
        </form>
      )}

      <Status tone={status.tone}>{status.text}</Status>

      <p className="tip">
        <Icon name="sparkle" size={16} />
        <span>
          Mit Key verfügbar: KI-Sortierung, „Automatisch (KI)“ und „Jetzt vorschlagen“ beim
          neuen Chat. Der Key bleibt lokal in deinem Browser und wird nur an die Gemini API
          von Google gesendet.
        </span>
      </p>

      {confirmDialog}
    </>
  );
}

export default ApiKeyPage;
