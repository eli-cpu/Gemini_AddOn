// Quick check for the Gemini API key (runs in Node, not in the extension):
//   node src/scripts/testAPI.js            -> test request
//   node src/scripts/testAPI.js --models   -> list available models
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

if (!GEMINI_KEY) {
  console.error("Fehler: GEMINI_API_KEY fehlt in der .env Datei!");
  process.exit(1);
}

async function testGeminiKey() {
  console.log(`[Gemini] Sende Test-Anfrage an ${MODEL} ...`);
  const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Antworte kurz mit: 'Der API-Key funktioniert!'" }] }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || res.statusText);
  console.log("Antwort:", data.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function listModels() {
  const res = await fetch(`${API_BASE}?pageSize=200`, {
    headers: { "x-goog-api-key": GEMINI_KEY },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || res.statusText);
  data.models
    .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
    .forEach((m) => console.log(` - ${m.name.replace("models/", "")}`));
}

(process.argv.includes("--models") ? listModels() : testGeminiKey()).catch((err) => {
  console.error("Fehler bei Gemini:", err.message);
  process.exit(1);
});
