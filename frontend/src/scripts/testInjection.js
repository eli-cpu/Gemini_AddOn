export function injectTestSeparator(doc = document) {
  const gemsContainer = doc.querySelector(".gems-list-container");
  const existing = doc.getElementById("my-test-separator");

  if (!gemsContainer) return "missing-container";
  if (existing) return "exists";

  const myDiv = doc.createElement("div");
  myDiv.id = "my-test-separator";
  myDiv.style.cssText = `
      padding: 15px;
      margin: 10px 0;
      text-align: center;
      border: 1px dashed #555;
      color: #aaa;
      font-size: 14px;
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
    `;
  myDiv.innerText = "--- TESTBEREICH ---";
  gemsContainer.after(myDiv);
  return "inserted";
}

export function startInjectionObserver(doc = document) {
  const observer = new MutationObserver(() => injectTestSeparator(doc));
  observer.observe(doc.body, { childList: true, subtree: true });
  injectTestSeparator(doc);
  return observer;
}

export function removeTestSeparator(doc = document) {
  const existing = doc.getElementById("my-test-separator");
  if (!existing) return "missing-separator";
  existing.remove();
  return "removed";
}

export function setTestSeparatorState(enabled, doc = document) {
  return enabled ? injectTestSeparator(doc) : removeTestSeparator(doc);
}

export function inject(doc = document, options = {}) {
  const { enabled, toggle = true } = options;
  if (typeof enabled === "boolean") return setTestSeparatorState(enabled, doc);

  if (!toggle) return injectTestSeparator(doc);

  const existing = doc.getElementById("my-test-separator");
  return existing ? removeTestSeparator(doc) : injectTestSeparator(doc);
}
