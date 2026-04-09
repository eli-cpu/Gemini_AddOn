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

// --- FUNKTIONEN ---

/**
 * Testet den Gemini API-Key
 */
async function testGeminiKey() {
  console.log("\n[Gemini] Sende Test-Anfrage...");
  const prompt = "Antworte kurz mit: 'Der API-Key funktioniert!'";

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log("--- Gemini Erfolg! ---");
    console.log("Antwort:", response.text());
  } catch (error) {
    console.error("--- Fehler bei Gemini ---");
    console.error("Nachricht:", error.message);
  }
}

/**
 * Listet verfügbare Gemini Modelle auf
 */
async function listModels() {
  console.log("\n[Gemini] Rufe Modell-Liste ab...");
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`,
    );
    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    console.log("Verfügbare Modelle:");
    data.models
      .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
      .forEach((m) => console.log(` - ${m.name.replace("models/", "")}`));
  } catch (error) {
    console.error("Fehler beim Abrufen der Modelle:", error.message);
  }
}

// --- EXECUTION ---

async function runTests() {
  console.log("Starte API-Tests...");

  await testGeminiKey();

  // Falls du die Liste sehen willst, entkommentiere die nächste Zeile:
  // await listModels();
}

runTests();
