import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../lib/storage";
import { PageHeader, Status } from "../components/ui";

function SettingsPage({ onBack }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState({ text: "", tone: "neutral" });

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const saved = await saveSettings(settings);
      setSettings(saved);
      setStatus({ text: "Einstellungen gespeichert.", tone: "success" });
    } catch (err) {
      setStatus({ text: err?.message || String(err), tone: "error" });
    }
  };

  const update = (key) => (e) => setSettings((s) => ({ ...s, [key]: e.target.value }));

  return (
    <>
      <PageHeader title="Einstellungen" onBack={onBack} />

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <div className="field-row">
            <label htmlFor="max-folders">Maximale Anzahl Ordner</label>
            <input
              id="max-folders"
              className="input number-input"
              type="number"
              min={1}
              max={100}
              value={settings.maxFolders}
              onChange={update("maxFolders")}
            />
          </div>
        </div>

        <div className="field">
          <div className="field-row">
            <label htmlFor="auto-delete">Automatisch löschen nach</label>
            <input
              id="auto-delete"
              className="input number-input"
              type="number"
              min={0}
              max={3650}
              value={settings.autoDeleteDays}
              onChange={update("autoDeleteDays")}
              aria-describedby="auto-delete-hint"
            />
          </div>
          <span id="auto-delete-hint" className="field-hint">
            Tage ohne Änderung am Ordner. 0 = nie löschen.
          </span>
        </div>

        <button className="btn btn-primary btn-block" type="submit">
          Speichern
        </button>
      </form>

      <Status tone={status.tone}>{status.text}</Status>
    </>
  );
}

export default SettingsPage;
