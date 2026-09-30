# Sicherheit

## Lücke melden

Bitte Sicherheitsprobleme **nicht** als öffentliches Issue melden, sondern über [GitHub Security Advisories](https://github.com/eli-cpu/Gemini_AddOn/security/advisories/new) („Report a vulnerability“). Ich melde mich so schnell wie möglich.

## API-Key

- Nutzer tragen ihren eigenen Key im Popup ein („KI aktivieren“). Er liegt in `chrome.storage.local` des Browser-Profils und wird **nicht** in den Build eingebettet – `dist/` und Release-ZIPs enthalten keinen Key.
- `chrome.storage.local` ist nicht verschlüsselt. Webseiten (auch gemini.google.com) haben keinen Zugriff, Programme mit Zugriff auf das Benutzerprofil schon.
- `GEMINI_API_KEY` in `.env` wird nur vom Entwickler-Testskript `testAPI.js` gelesen. `.env` ist in `.gitignore` – trotzdem vor jedem Commit prüfen.
- Falls ein Key öffentlich geworden ist: sofort in [Google AI Studio](https://aistudio.google.com/apikey) löschen und einen neuen erstellen. Aus der Git-Historie entfernen reicht nicht.
- Tipp: Den Key in der Google Cloud Console auf die „Generative Language API“ beschränken.
