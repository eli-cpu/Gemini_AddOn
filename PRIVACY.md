# Datenschutz

Gemini AddOn hat keinen eigenen Server und sammelt keine Nutzungsdaten. Es läuft auf gemini.google.com und chatgpt.com.

## Was lokal gespeichert wird

In `chrome.storage.local` deines Browser-Profils (Ordner getrennt pro Seite):
- Ordnernamen, Zeitstempel (erstellt/geändert) und Auf-/Zuklapp-Zustand
- pro einsortiertem Chat: die Chat-ID der jeweiligen Seite, Titel und Link
- Einstellungen (maximale Ordneranzahl, Auto-Löschen)
- dein Gemini-API-Key, falls du einen einträgst – getrennt davon in der IndexedDB der Extension, nur für Popup und Service Worker lesbar (Details: [SECURITY.md](SECURITY.md))

Diese Daten verlassen den Browser nicht (außer dem Key bei KI-Anfragen an Google) und werden beim Entfernen der Extension gelöscht. Den Key kannst du jederzeit im Popup unter „KI & API-Key“ entfernen.

## Was an die Gemini-API gesendet wird

Die KI-Funktionen nutzen auf beiden Seiten die Gemini-API von Google. Ohne gespeicherten API-Key sind sie ausgeblendet und es wird nichts gesendet. Mit Key nur dann, wenn du eine KI-Funktion nutzt, direkt an `generativelanguage.googleapis.com`:

| Funktion | Gesendete Daten |
|---|---|
| Key speichern (Popup) | nur der Key selbst, zur Prüfung (Abruf der Modell-Infos, keine Inhalte) |
| KI-Sortierung (Popup) | Titel der zu sortierenden Chats, Namen deiner Ordner |
| Automatisch (KI) / Jetzt vorschlagen | erste Nachricht des neuen Chats (max. 4000 Zeichen), Namen deiner Ordner |

Es werden keine Chat-Inhalte außer der ersten Nachricht gesendet. Für die Verarbeitung gelten die [Nutzungsbedingungen der Gemini API](https://ai.google.dev/gemini-api/terms) – beachte, dass Google Daten bei kostenlosen API-Keys zur Produktverbesserung verwenden kann.

## Berechtigungen

| Berechtigung | Wofür |
|---|---|
| `storage` | Ordner und Einstellungen speichern |
| `tabs`, `activeTab`, `scripting` | Content Script in Gemini-/ChatGPT-Tabs einfügen, mit dem aktiven Tab kommunizieren |
| `https://gemini.google.com/*`, `https://gemini.googleusercontent.com/*` | Folders-Bereich und Ordner-Button in Gemini anzeigen |
| `https://chatgpt.com/*` | Folders-Bereich und Ordner-Button in ChatGPT anzeigen |
| `https://generativelanguage.googleapis.com/*` | KI-Funktionen (Gemini-API) |
