importScripts("shared.js");
const { KEY, THEME, SETTINGS, settingsFrom, normalize, source } = ChatQuestions;
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "questions:action") return;
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (message.action === "openSettings") {
        await chrome.runtime.openOptionsPage();
        return { ok: true };
      }
      const stored = await chrome.storage.local.get([KEY, SETTINGS, THEME]);
      let settings = settingsFrom(stored[SETTINGS], stored[THEME]);
      let list = normalize(stored[KEY]);
      if (message.action === "settings") {
        if (!sender.url?.startsWith(chrome.runtime.getURL("")))
          throw new Error("Use the settings page");
        settings = settingsFrom(message.settings);
      }
      if (message.action === "add") {
        const item = message.item;
        if (
          !item ||
          typeof item.text !== "string" ||
          item.text.length > settings.maxLength ||
          !ChatQuestions.question(item.text, settings)
        )
          throw new Error("Invalid question");
        const url = source(sender.url || item.url),
          sourceId = typeof item.sourceId === "string" ? item.sourceId : "";
        const author =
          typeof item.author === "string" ? item.author.slice(0, 120) : "";
        const duplicate = list.some(
          (q) =>
            source(q.url) === url &&
            (sourceId
              ? q.sourceId === sourceId
              : q.text === item.text && q.author === author),
        );
        if (
          !duplicate &&
          settings.enabled &&
          (settings.includeReplay || !sender.url?.includes("/live_chat_replay"))
        )
          list.push({
            id: crypto.randomUUID(),
            text: item.text.trim(),
            author,
            sourceId,
            url,
            timestamp: Date.now(),
            isRead: false,
          });
      } else if (message.action === "toggle")
        list = list.map((q) =>
          q.id === message.id ? { ...q, isRead: !q.isRead } : q,
        );
      else if (message.action === "delete")
        list = list.filter((q) => q.id !== message.id);
      else if (message.action === "clear") {
        if (!sender.url?.startsWith(chrome.runtime.getURL("")))
          throw new Error("Use the extension popup");
        list = [];
      } else if (message.action !== "get" && message.action !== "settings")
        throw new Error("Unknown action");
      if (settings.maxQuestions) list = list.slice(-settings.maxQuestions);
      const update = { [KEY]: list };
      if (message.action === "settings") update[SETTINGS] = settings;
      await chrome.storage.local.set(update);
      return { ok: true, questions: list, settings };
    });
  queue.then(respond, () =>
    respond({ ok: false, error: "Could not save changes. Please try again." }),
  );
  return true;
});
