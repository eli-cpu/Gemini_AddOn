export function getConversations(root = document) {
  const conversationsList =
    root.getElementById?.("conversations-list-0") ??
    root.querySelector?.("#conversations-list-0");

  if (!conversationsList) {
    console.warn("conversations-list-0 nicht gefunden");
    return [];
  }

  const conversationItemSelector =
    ".conversation-items-container, .conversations-items-container";

  return Array.from(
    conversationsList.querySelectorAll(conversationItemSelector),
  ).map((container) => ({
    element: container,
    text: container.textContent?.trim() || "",
    html: container.innerHTML,
  }));
}
