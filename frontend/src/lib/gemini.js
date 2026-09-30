// Minimal Gemini REST client (no SDK needed in the extension).
// The API key is entered by the user in the popup and stored in
// chrome.storage.local (see lib/storage.js) – it is never built in.

// Optional build-time override of the model (GEMINI_MODEL in the repo .env).
export const GEMINI_MODEL = import.meta.env.GEMINI_MODEL || "gemini-flash-lite-latest";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const NO_KEY_MESSAGE = "Kein API-Key gespeichert. Im Popup unter „KI & API-Key“ eintragen.";

const SORT_SCHEMA = {
  type: "OBJECT",
  properties: {
    folders: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          chats: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["name", "chats"],
      },
    },
  },
  required: ["folders"],
};

const PICK_SCHEMA = {
  type: "OBJECT",
  properties: {
    folder: { type: "STRING" },
    isNew: { type: "BOOLEAN" },
  },
  required: ["folder", "isNew"],
};

// Turns Gemini API errors into short German messages.
function apiError(status, data) {
  const reason = data?.error?.details?.find?.((d) => d?.reason)?.reason || "";
  const message = data?.error?.message || "";
  if (reason === "API_KEY_INVALID" || /api key not valid/i.test(message)) {
    return new Error("Der API-Key ist ungültig.");
  }
  if (status === 403) return new Error("Der API-Key hat keinen Zugriff auf die Gemini API.");
  if (status === 429) return new Error("API-Limit erreicht. Bitte später erneut versuchen.");
  if (status === 404) return new Error(`Modell „${GEMINI_MODEL}“ ist für diesen Key nicht verfügbar.`);
  return new Error(`Gemini-API-Fehler (${status}): ${message || "unbekannt"}`);
}

async function generateJson(prompt, schema, { apiKey, model = GEMINI_MODEL }) {
  if (!apiKey) throw new Error(NO_KEY_MESSAGE);
  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(res.status, data);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (!text) throw new Error("Leere Antwort von Gemini.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Antwort von Gemini war kein gültiges JSON.");
  }
}

/**
 * Checks a key without spending tokens: fetches the model metadata.
 * Throws a readable error if the key is invalid or lacks access.
 */
export async function verifyApiKey(apiKey, model = GEMINI_MODEL) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Bitte einen API-Key eingeben.");
  let res;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}`, {
      headers: { "x-goog-api-key": key },
    });
  } catch {
    throw new Error("Keine Verbindung zur Gemini API. Internet prüfen.");
  }
  if (res.ok) return true;
  const data = await res.json().catch(() => ({}));
  throw apiError(res.status, data);
}

export function buildSortPrompt(titles, existingFolders, maxNewFolders) {
  const existing = existingFolders.length
    ? existingFolders.map((n) => `- ${n}`).join("\n")
    : "(keine)";

  return [
    "Du sortierst Chat-Verläufe eines Nutzers in thematische Ordner.",
    "",
    "Bereits vorhandene Ordner (bevorzugt verwenden, Namen exakt übernehmen):",
    existing,
    "",
    `Du darfst höchstens ${maxNewFolders} neue Ordner anlegen.`,
    "Neue Ordnernamen: kurz (1-3 Wörter), in der Sprache der Chat-Titel.",
    "Jeder Chat gehört in höchstens einen Ordner. Chats, die nirgends passen, weglassen.",
    "Keine leeren Ordner zurückgeben.",
    "",
    "Chats (Nummer. Titel):",
    ...titles.map((t, i) => `${i + 1}. ${t}`),
    "",
    'Antworte als JSON: {"folders":[{"name":"...","chats":[1,3]}]} – die Zahlen sind die Chat-Nummern.',
  ].join("\n");
}

/**
 * Asks Gemini to group chat titles.
 * @returns {Promise<Array<{name: string, chats: number[]}>>} 0-based indices
 */
export async function requestFolderSuggestions(titles, existingFolders, maxNewFolders, { apiKey, model } = {}) {
  const parsed = await generateJson(
    buildSortPrompt(titles, existingFolders, maxNewFolders),
    SORT_SCHEMA,
    { apiKey, model },
  );
  return (Array.isArray(parsed?.folders) ? parsed.folders : [])
    .map((f) => ({
      name: String(f?.name || "").trim(),
      chats: (Array.isArray(f?.chats) ? f.chats : [])
        .map((n) => Number(n) - 1)
        .filter((i) => Number.isInteger(i) && i >= 0 && i < titles.length),
    }))
    .filter((f) => f.name && f.chats.length);
}

/**
 * Picks the best folder for the first prompt of a new chat.
 * @returns {Promise<{name: string, isNew: boolean}>}
 */
export async function requestFolderForPrompt(prompt, existingFolders, allowNew, { apiKey, model } = {}) {
  if (!existingFolders.length && !allowNew) {
    throw new Error("Keine Ordner vorhanden und Ordner-Limit erreicht.");
  }
  const text = [
    "Ordne die erste Nachricht eines neuen Chats einem Ordner zu.",
    "",
    "Vorhandene Ordner:",
    existingFolders.length ? existingFolders.map((n) => `- ${n}`).join("\n") : "(keine)",
    "",
    allowNew
      ? "Nimm einen vorhandenen Ordner, wenn er thematisch passt (Namen exakt übernehmen). " +
        "Nur wenn keiner passt, schlage einen neuen, kurzen Ordnernamen (1-3 Wörter, Sprache der Nachricht) vor und setze isNew=true."
      : "Du MUSST einen der vorhandenen Ordner wählen (Namen exakt übernehmen), isNew=false.",
    "",
    "Nachricht:",
    '"""',
    prompt.slice(0, 4000),
    '"""',
    "",
    'Antworte als JSON: {"folder":"...","isNew":false}',
  ].join("\n");

  const parsed = await generateJson(text, PICK_SCHEMA, { apiKey, model });
  const name = String(parsed?.folder || "").trim().slice(0, 80);
  if (!name) throw new Error("Gemini hat keinen Ordner vorgeschlagen.");

  const match = existingFolders.find((n) => n.toLowerCase() === name.toLowerCase());
  if (match) return { name: match, isNew: false };
  // Model ignored the "existing only" constraint – fall back to the first folder.
  if (!allowNew) return { name: existingFolders[0], isNew: false };
  return { name, isNew: true };
}
