# Sicherheit

## Lücke melden

Bitte Sicherheitsprobleme **nicht** als öffentliches Issue melden, sondern über [GitHub Security Advisories](https://github.com/eli-cpu/Gemini_AddOn/security/advisories/new) („Report a vulnerability“). Ich melde mich so schnell wie möglich.

## Wie der API-Key geschützt ist

- Der Key wird im Popup eingetragen, vor dem Speichern bei Google geprüft und in **IndexedDB der Extension** (`chrome-extension://<id>`) gespeichert. Darauf haben nur das Popup und der Service Worker Zugriff.
- Er liegt **nicht** in `chrome.storage` (das auch Content Scripts lesen können). Das Content Script auf gemini.google.com bekommt nur ein `true/false`-Flag.
- Er wird nie in den Build eingebettet, nie in Nachrichten-Antworten, im DOM, in Logs oder Fehlermeldungen ausgegeben und im Popup nur gekürzt angezeigt (`AIza…x4k`).
- Er wird nur per HTTPS-Header (`x-goog-api-key`) an `generativelanguage.googleapis.com` gesendet – nie in der URL.
- Der Service Worker nimmt KI-Anfragen nur von der eigenen Extension an (Popup und Content Script auf Gemini). Es gibt kein `externally_connectable` und keine `web_accessible_resources`, Webseiten und andere Extensions können die Extension also nicht ansprechen oder einbetten.

| Angreifer | Kann den Key lesen? |
|---|---|
| Webseite / Phishing-Seite (auch gemini.google.com selbst) | Nein – Webseiten haben keinen Zugriff auf Extension-Speicher |
| PDF im Browser-PDF-Viewer | Nein – läuft isoliert, kein Zugriff auf andere Extensions |
| Andere Browser-Extensions | Nein – jede Extension hat eigenen Speicher |
| Kompromittierter Gemini-Tab (Renderer-Exploit) | Nein – der Key ist nicht im Speicher, den Content Scripts erreichen |
| Schadsoftware auf dem Rechner (z. B. über eine präparierte Datei in einem anfälligen PDF-Programm) | **Ja** – Browser-Daten liegen unverschlüsselt im Benutzerprofil. Dagegen schützt keine Extension. |
| Jemand, der dich dazu bringt, den Key auf einer fremden Seite einzugeben | **Ja** – die Extension fragt den Key nur im eigenen Popup ab, nie auf einer Webseite |

## Empfehlungen

- Eigenen Key nur für diese Extension verwenden und in der [Google Cloud Console](https://console.cloud.google.com/apis/credentials) auf die „Generative Language API“ beschränken; bei kostenpflichtigen Projekten ein Budget-Limit setzen.
- Falls ein Key öffentlich geworden ist: sofort in [Google AI Studio](https://aistudio.google.com/apikey) löschen und einen neuen erstellen. Aus der Git-Historie entfernen reicht nicht.
- `GEMINI_API_KEY` in `.env` wird nur vom Entwickler-Testskript `testAPI.js` gelesen. `.env` ist in `.gitignore` – trotzdem vor jedem Commit prüfen.
