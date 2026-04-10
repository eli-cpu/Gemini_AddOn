require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- KONFIGURATION ---
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error("Fehler: GEMINI_API_KEY fehlt in der .env Datei!");
  process.exit(1);
}

// Gemini Setup
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

function getTitles(chats) {
  if (!chats || chats.length === 0) {
    console.warn("Keine Chats zum Sortieren gefunden");
    return;
  }

  const titles = [];

  chats.forEach((chat) => {
    const titleDiv = chat.element.querySelector(".conversation-title");

    if (titleDiv) {
      titles.push(titleDiv.textContent?.trim() || "");
    } else {
      console.warn("Titel-Div nicht gefunden in:", chat.element);
    }
  });

  return titles;
}

export function sortChats(chats, maxNum, maxFolder) {
  const titles = getTitles(chats).slice(0, maxNum);

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
}

async function prompt(titles, maxFolder) {
  const prompt =
    "Du bist ein intelligenter Assistent, der Chat-Ordner basierend auf ihren Titeln sortiert. " +
    "Hier sind die Titel der Chat-Ordner:\n\n" +
    titles.map((t, i) => `${i + 1}. ${t}`).join("\n") +
    `\n\nSortiere diese Ordner in maximal ${maxFolder} Gruppen basierend auf Ähnlichkeiten. ` +
    "Gib die Gruppenzugehörigkeit als JSON zurück, z.B. { '1': [1, 3], '2': [2, 4] }.";

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("--- Gemini Erfolg! ---");
    // console.log("Antwort:", response.text());
  } catch (error) {
    console.error("--- Fehler bei Gemini ---");
    // console.error("Nachricht:", error.message);
  }
}
