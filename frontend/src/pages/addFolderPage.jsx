import { useState } from "react";

function AddFolderPage({ onBack }) {
  const [status, setStatus] = useState("");

  const handleCreateFolderButton = async () => {
    setStatus("");

    try {
      if (
        typeof chrome === "undefined" ||
        !chrome.tabs?.query ||
        !chrome.scripting?.executeScript
      ) {
        setStatus("Ordner-Erstellung nur in der Extension verfügbar.");
        return;
      }

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setStatus("Kein aktiver Tab gefunden.");
        return;
      }

      const folderName =
        window.prompt("Ordnername eingeben:", "Neuer Ordner")?.trim() ||
        "Neuer Ordner";

      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [folderName],
        func: (name) => {
          const list =
            document.querySelector("#conversations-list-0") ||
            document.querySelector('[id^="conversations-list-"]');

          if (!list) {
            return { ok: false, message: "Konversationsliste nicht gefunden." };
          }

          const before = document.querySelectorAll(
            "[data-gemini-folder], .gemini-folder",
          ).length;

          window.dispatchEvent(
            new CustomEvent("gemini-addon:create-folder", { detail: { name } }),
          );

          const after = document.querySelectorAll(
            "[data-gemini-folder], .gemini-folder",
          ).length;

          if (after > before) return { ok: true, name };

          // Fallback: direct DOM creation
          const folder = document.createElement("div");
          folder.className = "gemini-folder";
          folder.setAttribute(
            "data-gemini-folder",
            `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          );
          folder.setAttribute("data-folder-name", name);

          const header = document.createElement("div");
          header.className = "gemini-folder-header";
          header.setAttribute("data-gemini-folder-title", "true");
          header.textContent = name;

          const content = document.createElement("div");
          content.className = "gemini-folder-content";
          content.setAttribute("data-gemini-folder-content", "true");

          folder.appendChild(header);
          folder.appendChild(content);
          list.appendChild(folder);

          return { ok: true, name };
        },
      });

      const result = injection?.result;
      if (!result?.ok) {
        setStatus(result?.message || "Ordner konnte nicht erstellt werden.");
        return;
      }

      setStatus(`Ordner "${result.name}" erstellt.`);
    } catch (error) {
      console.error(error);
      setStatus("Ordner konnte nicht erstellt werden.");
    }
  };

  const handleInsertTestDiv = async () => {
    setStatus("");

    try {
      if (
        typeof chrome === "undefined" ||
        !chrome.tabs?.query ||
        !chrome.scripting?.executeScript
      ) {
        setStatus("DOM-Test nur in der Extension verfügbar.");
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setStatus("Kein aktiver Tab gefunden.");
        return;
      }

      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const target =
            document.querySelector(
              "div.chat-history div.chat-history-list conversations-list[data-test-id='all-conversations']",
            ) || document.querySelector("conversations-list[data-test-id='all-conversations']");

          if (!target || !target.parentElement) {
            return { ok: false, message: "Ziel-Div nicht gefunden." };
          }

          const existing = document.querySelector("[data-gemini-test-div='true']");
          if (existing) existing.remove();

          const testDiv = document.createElement("div");
          testDiv.setAttribute("data-gemini-test-div", "true");
          testDiv.className = "gemini-test-div";
          testDiv.textContent = "TEST DIV (über conversations-list)";

          target.parentElement.insertBefore(testDiv, target);
          return { ok: true };
        },
      });

      if (!injection?.result?.ok) {
        setStatus(
          injection?.result?.message || "Test-Div konnte nicht eingefügt werden.",
        );
        return;
      }

      setStatus("Test-Div wurde über der Chatliste eingefügt.");
    } catch (error) {
      console.error(error);
      setStatus("Test-Div konnte nicht eingefügt werden.");
    }
  };

  return (
    <>
      <h1>Ordner erstellen</h1>
      <p className="subline">Manuelles Erstellen eines Ordners auslösen</p>

      <button className="counter" onClick={handleCreateFolderButton}>
        erstelleFolderButton
      </button>

      <button className="counter" onClick={handleInsertTestDiv}>
        Test-Div über Chatliste einfügen
      </button>

      <button className="counter" onClick={onBack}>
        Zurück
      </button>

      {status && <p className="status">{status}</p>}
    </>
  );
}

export default AddFolderPage;
