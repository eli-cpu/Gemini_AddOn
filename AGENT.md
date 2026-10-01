# AGENT.md

Guide for AI coding agents (and humans) working on this repo. Read this before changing code.

## What this is

A Manifest V3 Chrome extension that adds folders to **Google Gemini** (`gemini.google.com`) and **ChatGPT** (`chatgpt.com`). UI text is **German**; code comments are English. The AI features always use the Gemini API with the user's key, on both sites.

Three runtimes, all in `frontend/`:

| Runtime | Source | Built to | Notes |
|---|---|---|---|
| Content script | `public/autoFolderInit.js` | copied as-is to `dist/` | Plain JS IIFE, **no imports, no build step**. Runs on Gemini and ChatGPT. |
| Service worker | `src/background.js` | `dist/background.js` (ES module) | AI sorting + folder suggestion. Bundled by Vite. |
| Popup | `index.html`, `src/App.jsx`, `src/pages/*` | `dist/index.html`, `dist/assets/*` | React 19. 360px wide. |

## Commands

Run from `frontend/`:

```bash
npm ci
npm run lint     # must pass (0 errors)
npm run build    # outputs dist/ – load this folder in chrome://extensions
npm run icons    # re-render public/icons/*.png from icons/*.svg (rsvg-convert + ImageMagick)
node src/scripts/testAPI.js   # dev-only: checks GEMINI_API_KEY from ../.env (the extension doesn't use it)
```

There is no test framework in the repo. For content-script logic, a throwaway jsdom harness works well (load `dist/autoFolderInit.js` into a `JSDOM` with `runScripts: "outside-only"` and a fake `chrome.storage`/`chrome.runtime`). Don't commit such harnesses unless a real test setup is added.

## Architecture

**Per-site support**: `src/lib/sites.js` (popup/background) and the `SITES` object at the top of `autoFolderInit.js` (content script) hold every site-specific selector and config. The active site is detected from `window.location.hostname` (content script) or the tab/sender URL (`siteForUrl`, popup/background) — never from a message field. To add a site, extend both `SITES` objects, add host patterns to the manifest (`host_permissions` + `content_scripts.matches`), and give it its own `stateKey`.

**State** lives in `chrome.storage.local`:
- Folder state, **one key per site**: `ga_folders_state_v3` (Gemini, unchanged so existing data survives) and `ga_folders_state_v3_chatgpt` (ChatGPT). Shape: `{ version: 3, collapsed, folders: [{ id, name, expanded, createdAt, updatedAt, chats: [{ key, title, href }] }], looseChats: [...] }`. Use `stateKeyFor(site)` / `loadState(site)` / `saveState(state, site)` / `updateState(mutator, site)`.
- `ga_settings_v1`: `{ maxFolders, autoDeleteDays }` (shared across sites).
- `ga_popup_site_v1`: last site chosen in the popup (UI preference).
- `ga_ai_enabled_v1`: boolean "an API key is saved". The only AI-related value the content script may read.
- **The API key itself is NOT in `chrome.storage`** (that area is readable by content scripts, which run in the gemini.google.com renderer). It lives in IndexedDB of the extension origin (`src/lib/secretStore.js`, DB `ga-secrets`), reachable only from the popup and the service worker. Use `saveApiKey`/`loadApiKey`/`removeApiKey` from `lib/storage.js`; they keep the flag in sync. Never pass the key to the content script, never put it in a message response, DOM, log or error text. A key found under the old `ga_api_key_v1` entry is migrated away automatically (`migrateLegacyApiKey`).
- Chat `key` is `id:<conversationId>`, from the site's chat link (`/app/<id>` on Gemini, `/c/<id>` on ChatGPT); fallback `title:<title>`. Links are matched **same-origin only** (`chatIdFromHref`) so links inside chat answers aren't treated as chats, and stored `href`s are sanitized to same-origin paths (`safeChatHref`).
- Legacy keys `ga_folders_state_v2` / `ga_folders_html_v1` are migrated once by the Gemini content script only.

**The state shape and normalizers are duplicated** in `public/autoFolderInit.js` and `src/lib/storage.js` (the content script can't import). Change both together.

**Data flow**: every writer (popup, background, content script) writes the whole state; the content script listens to `storage.onChanged` and re-renders. It ignores echoes of its own writes via the `pendingSaves` snapshot list.

**Messages**:
- Popup → content script: `ga:ping`, `ga:refresh` (returns `{ site, mounted, nativeCount }`), `ga:get-chats` (returns `{ site, chats }`).
- Popup/content → background: `ga:ai-sort` `{ tabId, options }`, `ga:suggest-folder` `{ prompt }`. The background derives the site from the tab/sender URL, not the message.
- `src/lib/tabs.js#sendToTab` injects the content script first if the tab doesn't have it; `getActiveChatTab()` returns `{ tab, site }`.

**Gemini API**: `src/lib/gemini.js`, REST `generateContent` with `responseSchema` (structured JSON). Every request function takes `{ apiKey }`; the background loads it via `requireApiKey()`. Only the model can be set at build time (`GEMINI_MODEL`, `vite.config.js`: `envPrefix: ["VITE_", "GEMINI_MODEL"]`). **Never expose `GEMINI_API_KEY` to the bundle** – don't widen `envPrefix` to `GEMINI_`.

**AI gating**: without a saved key, every AI feature must be invisible, not just disabled:
- Popup: `useApiKey()` (`src/lib/useApiKey.js`); the KI-Sortierung menu entry and page only render with a key, otherwise a "KI aktivieren" entry leads to `apiKeyPage.jsx`.
- Content script: `aiEnabled` from the `ga_ai_enabled_v1` flag (must be exactly `true`, updated live via `storage.onChanged`); the "Mit KI" section of the folder menu is omitted and AI-only choices (`__auto__`, AI-suggested new folder) are reset in `validateChoice()`.
- Background: `requireApiKey()` rejects AI messages as a last line of defence; `isTrustedSender()` only accepts our own extension pages and content scripts on a supported site.
New AI features must follow the same three layers.

## Content script rules (important)

- **The DOM of both sites is unstable.** Every site-specific selector is in the `SITES` object at the top of `autoFolderInit.js` — never hardcode a selector below it; add fallbacks there instead. Detect chats by their link (`SITE.linkSelector` + `SITE.chatPathRe`), not by class names.
- **Only mount in the sidebar.** The Folders section must never land in the main content. `getSidebarRoot()` rejects candidates that contain `SITE.mainSelector`.
- **Hide foldered chats only in the sidebar**, via the `data-ga-hidden` attribute (`HIDDEN_ATTR`) — not a class, because React/Angular rewrite `className` on re-render. Never hide search results.
- `ensure()` runs (throttled, 200 ms) on every DOM mutation. Anything it calls must be **idempotent and cheap**, and must not re-render UI that the user is interacting with (see `menuSignature()` / `editing` guards). Otherwise focus and typed text get lost.
- No `innerHTML` for dynamic content (Trusted Types, XSS). Build SVG via `createElementNS` (`svgIcon()`), text via `textContent`. Use `safeAll`/`safeMatches` for selectors that may be invalid in older engines (e.g. `:has()`).
- Stop `keydown` propagation in our inputs/menus so the site's shortcuts don't fire.
- After an extension reload, old instances are orphaned: guard `chrome.*` calls with `selfAlive()` and register teardown functions in `cleanups`.
- Scope all CSS under `#gemini-folder-drop-zone`, `#ga-new-chat-folder-picker`, `.ga-picker-menu`, `#ga-toast`. Use the `--ga-*` custom properties; theme via `:root[data-ga-theme]`, per-site overrides via `:root[data-ga-site="chatgpt"]`.

## Popup rules

- Don't use `window.confirm/alert/prompt` – Chrome draws them larger than the popup and they get cut off. Use `useConfirm()` (`src/components/useConfirm.jsx`).
- Shared UI in `src/components/ui.jsx` (`Icon`, `IconButton`, `PageHeader`, `Status`, `ConfirmDialog`). Theme tokens in `src/index.css`.
- ESLint `react-refresh/only-export-components`: files exporting components must not export hooks/constants.
- ESLint `react-hooks/set-state-in-effect`: don't call `setState` synchronously in an effect body.

## Conventions

- German for all user-facing strings; keep tone short and friendly.
- Accessibility: real `<button>`s, `aria-label` on icon buttons, `aria-expanded`/`aria-checked` on toggles/menus, visible `:focus-visible`, keyboard support (Enter/Space/Esc/arrows) for custom menus.
- Pin new dependencies to exact versions. Avoid new dependencies for small things.

## Security & privacy

- **Never commit `.env`**. The API key lives only in `chrome.storage.local` (entered by the user); builds must not contain one – check with `grep -rE "AIza[0-9A-Za-z_-]{20,}" frontend/dist` (must be empty). Never log the key or show it unmasked (`maskApiKey`).
- Only send to the Gemini API what the feature needs (titles, first prompt, folder names) and document any new data flow in `PRIVACY.md` and the README.
- Keep `host_permissions` minimal (Gemini + ChatGPT + `generativelanguage.googleapis.com`).
- Treat chat links as untrusted: only same-origin chat paths are chats (`chatIdFromHref`), and hrefs are sanitized before use (`safeChatHref`).

## Before you finish

1. `npm run lint` and `npm run build` pass.
2. If you touched the content script: verify mount position, drag & drop, reload (F5) persistence, and the new-chat folder button – at least in a jsdom harness; mention if not tested in a real browser.
3. If you touched anything AI-related: check both with and without a saved key.
4. Update README/PRIVACY/AGENT.md if behavior, storage shape, messages or data flows changed.
