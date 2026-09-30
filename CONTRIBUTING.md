# Mitmachen

Danke fürs Interesse! Issues und Pull Requests sind willkommen.

## Setup

```bash
cd frontend
npm ci
npm run build           # dist/ in chrome://extensions laden
```

KI-Funktionen testen: API-Key im Popup unter „KI aktivieren“ eintragen. Ohne Key müssen alle KI-Elemente unsichtbar sein – bitte beide Fälle prüfen.

Architektur, Konventionen und Stolperfallen: [AGENT.md](AGENT.md).

## Pull Requests

- Ein Thema pro PR, kurze Beschreibung: was, warum, wie getestet.
- `npm run lint` und `npm run build` müssen durchlaufen (prüft auch die CI).
- Änderungen am Content Script bitte in Gemini testen: Folders-Bereich in der Seitenleiste, Drag & Drop, Neuladen (F5), Ordner-Button beim neuen Chat. Wenn nicht möglich, im PR erwähnen.
- UI-Texte auf Deutsch, Code-Kommentare auf Englisch.
- Neue Datenflüsse zur Gemini-API in [PRIVACY.md](PRIVACY.md) ergänzen.
- Kein `.env`, keine API-Keys, kein `dist/` committen.
- Neue KI-Funktionen nur anzeigen, wenn ein Key gespeichert ist (siehe AGENT.md).

## Gemini hat das Layout geändert?

Das ist der häufigste Fehler. Im [Bug-Report](https://github.com/eli-cpu/Gemini_AddOn/issues/new?template=bug_report.md) bitte angeben:
- die Konsolen-Zeile `[Gemini AddOn] aktiv – … Chats erkannt` (DevTools → Konsole)
- den HTML-Ausschnitt des betroffenen Elements (Rechtsklick → „Untersuchen“ → Element → „Copy outerHTML“). Vorher persönliche Chat-Titel entfernen.
