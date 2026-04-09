export function getConversations() {
  const conversationsList = document.getElementById("conversations-list-0");

  if (!conversationsList) {
    console.warn("conversations-list-0 nicht gefunden");
    return [];
  }

  const containers = conversationsList.querySelectorAll(
    ".conversations-items-container",
  );

  return Array.from(containers).map((container) => ({
    element: container,
    text: container.textContent?.trim() || "",
    html: container.innerHTML,
  }));
}
