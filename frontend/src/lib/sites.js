// Supported chat sites. Keep ids, hosts and state keys in sync with the
// SITES config in public/autoFolderInit.js and the manifest.

export const SITES = {
  gemini: {
    id: "gemini",
    label: "Gemini",
    hosts: ["gemini.google.com", "gemini.googleusercontent.com"],
    url: "https://gemini.google.com/app",
    // Kept unchanged from the Gemini-only versions so existing folders stay.
    stateKey: "ga_folders_state_v3",
  },
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    hosts: ["chatgpt.com"],
    url: "https://chatgpt.com/",
    stateKey: "ga_folders_state_v3_chatgpt",
  },
};

export const SITE_IDS = Object.keys(SITES);
export const DEFAULT_SITE = "gemini";

export const SITE_URL_PATTERNS = Object.values(SITES).flatMap((s) =>
  s.hosts.map((host) => `https://${host}/*`),
);

/** Site id for a URL, or null if the URL isn't a supported chat site. */
export function siteForUrl(url = "") {
  let host;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    host = parsed.hostname;
  } catch {
    return null;
  }
  return Object.values(SITES).find((s) => s.hosts.includes(host))?.id || null;
}

export const isSupportedUrl = (url) => !!siteForUrl(url);

export const normalizeSite = (site) => (SITES[site] ? site : DEFAULT_SITE);

export const siteLabel = (site) => SITES[normalizeSite(site)].label;
