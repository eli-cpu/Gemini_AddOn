export const CONVERSATION_ITEM_SELECTOR =
  ".conversation-items-container, .conversations-items-container";

export function getConversations(root = document) {
  const conversationsList =
    root.getElementById?.("conversations-list-0") ??
    root.querySelector?.("#conversations-list-0");

  if (!conversationsList) {
    console.warn("conversations-list-0 nicht gefunden");
    return [];
  }

  return Array.from(
    conversationsList.querySelectorAll(CONVERSATION_ITEM_SELECTOR),
  ).map((container) => ({
    element: container,
    text: container.textContent?.trim() || "",
    html: container.innerHTML,
  }));
}
