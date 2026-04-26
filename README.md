# Gemini AddOn

Eine Chrome-Extension für Google Gemini, die es ermöglicht, Chats in Ordnern zu organisieren und per Drag & Drop zu verwalten.

## Features

### ✅ Implementiert

- **Automatischer Folder-Bereich**: Beim Laden von Gemini wird automatisch ein "Folders"-Bereich erstellt
- **Persistierung**: Folder-Inhalt wird in `chrome.storage.local` gespeichert und beim Laden wiederhergestellt
- **Drag & Drop**: Chats können in den Folder-Bereich oder direkt in Ordner gezogen werden
- **Einklappbare Ordner**: Ordner können auf- und zugeklappt werden (> wenn eingeklappt, ⌄ wenn ausgeklappt)
- **Chat-Verwaltung in Ordnern**: Gezogene Chats bleiben im Ordner und behalten ihr Design
- **Active-State Management**: Nur ein Chat pro Sektion ist aktiv; Klicks auf externe Chats deaktivieren Folder-Einträge
- **Chat-Öffnung**: Klick auf einen Chat im Folder öffnet ihn automatisch

## 🔧 Bedienung

1. **Extension laden**:
   - Im Browser zu `chrome://extensions` gehen
   - Entwicklermodus aktivieren
   - Ordner laden (untitled)

2. **Folder-Bereich nutzen**:
   - Beim Öffnen von [Gemini](https://gemini.google.com) wird automatisch der "Folders"-Bereich unter den Chats erstellt
   - Button **"Drag & Drop aktivieren"** klicken, falls es noch nicht aktiv ist
   - Alternativ einfach **"Create Folder"** klicken: Drag & Drop wird dabei automatisch aktiviert

3. **Ordner erstellen**:
   - Button **"Create Folder"** klicken
   - Namen eingeben
   - Ordner erscheint unter "Folders"

4. **Chats organisieren**:
   - Chat in den "Folders"-Bereich ziehen → wird unterhalb der Ordner gespeichert
   - Chat auf einen Ordner ziehen → wird darunter eingefügt und der Ordner öffnet sich
   - Auf einen Chat im Folder klicken → wird aktiv (blau hinterlegt)
   - Auf externen Chat klicken → deaktiviert alle Folder-Einträge

## 📋 Tech-Stack

- **React** (Frontend für Popup)
- **Chrome Extension APIs** (Manifest V3)
- **Content Scripts** (Auto-Injection bei Gemini-Laden)
- **Drag & Drop API** (HTML5 Standard)

## 📁 Projektstruktur

```
frontend/
├── public/
│   ├── manifest.json          # Extension-Manifest
│   ├── autoFolderInit.js      # Auto-Init per Content Script
│   └── background.js          # Service Worker (optional)
├── src/
│   ├── App.jsx                # Haupt-UI
│   ├── scripts/
│   │   ├── folderDragDrop.js  # Drag & Drop-Logik
│   │   ├── createCollapsibleFolder.js # Ordner-Erstellung
│   │   ├── bindFolderOutsideActiveSync.js # Active-State Management
│   │   ├── executeInActiveTab.js # Chrome API Utility
│   │   └── background.js      # Utility-Funktionen
│   └── pages/
│       ├── sortPage.jsx       # (TODO: Sortierung)
│       └── addFolderPage.jsx  # (TODO: Ordner-Verwaltung)
```

### ⚠️ Bekannte Limitationen

- **Keine KI-Sortierung**: Ordner müssen manuell erstellt und gefüllt werden
- **Nur Ordnerung**: Keine automatische Kategorisierung oder intelligente Organisation

### 🚀 Nächste Schritte (TODO)

- [ ] **Speicherung**: Ordner-Struktur per `chrome.storage.local` persistieren
- [ ] **KI-Sortierung**: Chats automatisch kategorisieren
- [ ] **Sortier-Seite**: UI für erweiterte Ordner-Verwaltung
- [ ] **Einstellungen**: Maximal-Anzahl Ordner, Auto-Delete nach Datum
- [ ] **Icons**: Ordner-Icons, Delete-Buttons

### 🔗 Links

- [Google Gemini](https://gemini.google.com)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

---

**Version**: 1.0.0  
**Lizenz**: MIT
