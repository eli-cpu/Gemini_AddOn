# Veröffentlichen auf GitHub – Checkliste

## 1. Vor dem ersten öffentlichen Push

- [ ] `git status` prüfen: kein `.env`, kein `dist/`, keine `node_modules/`
- [ ] Nach Keys suchen: `git log --all -p | grep -E "AIza[0-9A-Za-z_-]{20,}"` → muss leer sein
      (Stand 30.09.2026: Historie ist sauber)
- [ ] Falls je ein Key committet wurde: Key in AI Studio löschen und neu erstellen
- [ ] `cd frontend && npm run lint && npm run build` läuft durch
- [ ] Ungenutzte Altdateien entfernen (werden nirgends importiert):
      `src/scripts/createFolder.js`, `getChats.js`, `injectFolder.js`, `manipulateChats.js`, `saveChanges.js`, `testInjection.js`
- [ ] Copyright-Name in `LICENSE` prüfen

## 2. Repository-Einstellungen (github.com → Settings)

- [ ] **General**: Beschreibung, z. B. „Chrome extension: organize Gemini and ChatGPT chats in folders – drag & drop, manual or AI-powered“
- [ ] **Topics**: `chrome-extension`, `gemini`, `chatgpt`, `manifest-v3`, `react`, `vite`, `productivity`
- [ ] **Visibility** → Public
- [ ] **Security** → Private vulnerability reporting aktivieren (für `SECURITY.md`)
- [ ] **Security** → Secret scanning + Push protection aktivieren (blockt versehentliche Key-Pushes)
- [ ] **Branches** → Branch-Schutz für `main`: PR + grüner CI-Check erforderlich
- [ ] Screenshots/GIF (Folders-Bereich, Ordner-Button, Popup) ins README – vorher persönliche Chat-Titel unkenntlich machen

## 3. Release (optional)

Ein fertiges ZIP ist für Nutzer bequemer. Der API-Key wird nicht mehr eingebettet – Nutzer tragen ihren eigenen Key im Popup ein.

```bash
cd frontend
npm run build
grep -rEc "AIza[0-9A-Za-z_-]{20,}" dist | grep -v ":0"   # muss leer sein
cd dist && zip -r ../../gemini-addon-v1.0.0.zip . && cd -
```

- [ ] Version in `frontend/public/manifest.json` und `frontend/package.json` erhöhen
- [ ] `git tag v1.0.0 && git push --tags`, dann auf GitHub **Releases → Draft a new release**, ZIP anhängen
- [ ] In den Release-Notes erwähnen: KI-Funktionen über Popup → „KI aktivieren“ mit eigenem Key freischalten

## 4. Chrome Web Store (optional, später)

- Entwicklerkonto (einmalige Gebühr), [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Voraussetzungen: Datenschutzerklärung als öffentliche URL (z. B. `PRIVACY.md` auf GitHub), Begründung für jede Berechtigung (Tabelle in `PRIVACY.md`), Store-Screenshots 1280×800
- Namen/Icon so wählen, dass keine Verwechslung mit einem offiziellen Google- oder OpenAI-Produkt entsteht (der aktuelle Name „Gemini AddOn“ ist dafür ungeeignet, da jetzt auch ChatGPT unterstützt wird – z. B. „Chat Folders“)
- Zwei Berechtigungen für Host-Zugriff (gemini.google.com, chatgpt.com) im Review begründen
