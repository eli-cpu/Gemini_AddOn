# Gemini AddOn

Chrome-Extension für [Google Gemini](https://gemini.google.com) und [ChatGPT](https://chatgpt.com), mit der du Chats in Ordnern organisierst – per Drag & Drop, manuell beim ersten Prompt oder automatisch per KI.

> Inoffizielles Projekt, nicht mit Google oder OpenAI verbunden. „Gemini“ ist eine Marke von Google LLC, „ChatGPT“ eine Marke von OpenAI.

## Features

Funktioniert auf **gemini.google.com** und **chatgpt.com**. Jede Seite hat ihre eigenen Ordner.

**In der Seitenleiste**
- **Folders-Bereich** in der Seitenleiste, einklappbar, passt sich an helles/dunkles Theme an. Erscheint nur in der Seitenleiste, nicht im Chat-Bereich.
- **Drag & Drop** ist immer aktiv: Chats aus der Seitenleiste (bei Gemini auch aus den Suchergebnissen) auf „Folders“ oder direkt auf einen Ordner ziehen; auch zwischen Ordnern.
- **Ordner** auf- und zuklappen, umbenennen und löschen direkt in der Liste; Chats per **×** wieder entfernen.
- **Einsortierte Chats** werden in der normalen Chat-Liste ausgeblendet (bei Gemini bleiben sie in der **Suche** sichtbar).
- **Aktiver Chat** ist im Folders-Bereich hervorgehoben; Klick öffnet den Chat.

**Beim neuen Chat (Eingabeleiste)**
- **Ordner-Button** in der Eingabeleiste (bei Gemini neben „Flash/Pro“, bei ChatGPT neben dem Mikrofon/Senden). Menü:
  - *Manuell*: Kein Ordner, vorhandener Ordner oder **Neuer Ordner …** (Namen direkt eintippen)
  - *Mit KI*: **Automatisch (KI)** – Ordner wird beim Senden gewählt; **Jetzt vorschlagen** – Vorschlag anhand der eingegebenen Nachricht
- Nach dem Senden wird der Chat automatisch einsortiert.

**Popup**
- **Seiten-Umschalter** (Gemini / ChatGPT); ein Punkt markiert die Seite des aktiven Tabs
- Ordner erstellen, Verbindungsstatus zum aktiven Tab
- **KI aktivieren / KI & API-Key**: eigenen Gemini-API-Key eintragen (wird vor dem Speichern geprüft), ersetzen oder entfernen
- **KI-Sortierung**: die geladenen Chats des aktiven Tabs thematisch in Ordner einsortieren
- **Ordner verwalten**: umbenennen, löschen, Chats entfernen – pro Seite
- **Einstellungen**: maximale Anzahl Ordner, automatisches Löschen von Ordnern nach X Tagen ohne Änderung

**KI immer über Gemini**: Die KI-Funktionen nutzen auf beiden Seiten die Gemini-API mit deinem Key. Ohne Key sind sie ausgeblendet; Ordner, Drag & Drop und die manuelle Ordnerwahl funktionieren immer.

**Speicherung**: Alles liegt lokal in `chrome.storage.local` (als Daten, nicht HTML) und ist nach einem Neuladen identisch. Ältere Speicherstände werden automatisch migriert.

## Installation

Es gibt (noch) kein fertiges Paket – die Extension wird aus dem Quellcode gebaut.

**Voraussetzungen**: Node.js ≥ 20.19 (oder ≥ 22.12), ein Chromium-Browser (Chrome, Edge, Brave …), optional ein kostenloser [Gemini-API-Key](https://aistudio.google.com/apikey) für die KI-Funktionen.

```bash
git clone https://github.com/eli-cpu/Gemini_AddOn.git
cd Gemini_AddOn/frontend
npm ci
npm run build
```

Dann im Browser:
1. `chrome://extensions` öffnen und den **Entwicklermodus** aktivieren
2. **Entpackte Erweiterung laden** → den Ordner **`frontend/dist`** wählen (nicht `frontend`!)
3. Gemini- bzw. ChatGPT-Tab neu laden (F5)

Nach Code-Änderungen: `npm run build`, dann auf der Extension-Karte auf **Neu laden** klicken und den Tab neu laden.

### KI-Funktionen aktivieren

1. Kostenlosen Key in [Google AI Studio](https://aistudio.google.com/apikey) erstellen
2. Popup öffnen → **KI aktivieren** → Key einfügen → **Speichern**
3. Die KI-Funktionen erscheinen sofort – im Popup und im Ordner-Menü auf der Seite

Der Key wird nur lokal im Browser gespeichert und nie in den Build eingebettet. Entfernen: Popup → **KI & API-Key** → **Entfernen**.

### Optionale Entwickler-Konfiguration (`.env` im Repository-Root)

| Variable | Beschreibung |
|---|---|
| `GEMINI_MODEL` | Modell für die KI-Funktionen (Build-Zeit), Standard `gemini-flash-lite-latest` |
| `GEMINI_API_KEY` | nur für das Testskript `node src/scripts/testAPI.js` (Modelle auflisten: `--models`) – wird **nicht** von der Extension verwendet |

## Datenschutz

Ordner, Chat-Titel und dein API-Key bleiben lokal im Browser. Nur bei den KI-Funktionen werden Daten mit deinem eigenen API-Key direkt an die Gemini-API gesendet (auch wenn du auf ChatGPT bist):
- **KI-Sortierung**: die Titel der sortierten Chats und die Ordnernamen
- **Automatisch (KI)** / **Jetzt vorschlagen**: die erste Nachricht des neuen Chats und die Ordnernamen

Details: [PRIVACY.md](PRIVACY.md)

## Hinweise & Limitationen

- **API-Key-Speicherung**: Der Key liegt in der IndexedDB der Extension und ist nur für Popup und Service Worker lesbar – nicht für Webseiten, PDFs, andere Extensions oder das Content Script. Wie alle Browser-Daten ist er auf der Festplatte unverschlüsselt; Schadsoftware auf dem Rechner könnte ihn lesen. Details: [SECURITY.md](SECURITY.md).
- **Unstabiles DOM**: Die Extension liest die Oberfläche von Gemini und ChatGPT (Chat-Links `/app/<id>` bzw. `/c/<id>`, Seitenleiste, Eingabeleiste). Ändern Google oder OpenAI das Layout, können Teile ausfallen – bitte dann ein [Issue](https://github.com/eli-cpu/Gemini_AddOn/issues) mit dem HTML-Ausschnitt eröffnen. Die Selektoren stehen gesammelt im `SITES`-Objekt in `frontend/public/autoFolderInit.js`.
- **KI-Sortierung** sieht nur Chats, die in der Seitenleiste bereits geladen sind (ggf. vorher runterscrollen).
- **Getrennte Ordner**: Gemini- und ChatGPT-Ordner sind unabhängig. Mehrere Konten im selben Browser-Profil teilen sich die Ordner einer Seite.
- Gelöschte Ordner löschen keine Chats – die Chats erscheinen nur wieder in der normalen Liste.

## Entwicklung

```bash
cd frontend
npm run lint     # ESLint
npm run build    # Build nach frontend/dist
npm run icons    # Icons aus frontend/icons/*.svg neu erzeugen (braucht rsvg-convert + ImageMagick)
```

Aufbau, Konventionen und Stolperfallen stehen in [AGENT.md](AGENT.md); Beiträge siehe [CONTRIBUTING.md](CONTRIBUTING.md).

```
.env.example                     # Vorlage für .env
frontend/
├── public/
│   ├── manifest.json            # Manifest V3
│   └── autoFolderInit.js        # Content Script (SITES-Config, Folders-Bereich, Drag & Drop, Ordner-Button)
└── src/
    ├── App.jsx                  # Popup-Startseite mit Seiten-Umschalter
    ├── background.js            # Service Worker: KI-Sortierung, Ordner-Vorschlag
    ├── components/              # UI-Bausteine (Icons, Dialog, Seiten-Umschalter)
    ├── lib/                     # sites.js, storage.js, gemini.js, tabs.js, useApiKey.js
    ├── pages/                   # KI-Sortierung, Ordner verwalten, Einstellungen, API-Key
    └── scripts/testAPI.js       # API-Key-Test (Node)
```

## Lizenz

[MIT](LICENSE)
