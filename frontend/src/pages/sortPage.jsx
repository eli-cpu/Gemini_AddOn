import { useState } from "react";
import { getConversations } from "../scripts/getChats";
import { sortChats } from "../scripts/sortChats";

function SortPage({ onBack }) {
  const [status, setStatus] = useState("");

  const readConversationsForTests = async () => {
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
        throw new Error("Kein aktiver Tab gefunden.");
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const list = document.getElementById("conversations-list-0");
          if (!list) return [];
          const items = list.querySelectorAll(
            ".conversation-items-container, .conversations-items-container",
          );
          return Array.from(items).map((container) => ({
            text: container.textContent?.trim() || "",
            html: container.innerHTML,
          }));
        },
      });

      return result?.result || [];
    }

    return getConversations().map(({ text, html }) => ({ text, html }));
  };

  const handleTestGetConversations = async () => {
    setStatus("");
    try {
      const conversations = await readConversationsForTests();
      console.log("Conversations:", conversations);
      setStatus(`${conversations.length} Chats gefunden.`);
    } catch (error) {
      console.error(error);
      setStatus("Test fehlgeschlagen.");
    }
  };

  const handleTestSortChats = async (label = "sortChats") => {
    setStatus("");
    try {
      const conversations = await readConversationsForTests();
      const sorted = sortChats([...conversations]) ?? conversations;
      console.log(`${label} input:`, conversations);
      console.log(`${label} output:`, sorted);
      setStatus(`${label}-Test ok (${sorted.length} Chats).`);
    } catch (error) {
      console.error(error);
      setStatus(`${label}-Test fehlgeschlagen.`);
    }
  };

  return (
    <>
      <h1>Sortierung</h1>
      <p className="subline">Tests für Chat-Erkennung und Sortierung</p>

      <button className="counter" onClick={handleTestGetConversations}>
        Test: getConversations
      </button>

      <button
        className="counter"
        onClick={() => handleTestSortChats("sortChats")}
      >
        Test: sortChats
      </button>

      <button
        className="counter"
        onClick={() => handleTestSortChats("Extra sortChats")}
      >
        Test: sortChats (extra)
      </button>

      <button className="counter" onClick={onBack}>
        Zurück
      </button>

      {status && <p className="status">{status}</p>}
    </>
  );
}

export default SortPage;
