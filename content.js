(() => {
  if (
    !/^\/live_chat(?:_replay)?$/.test(location.pathname) ||
    globalThis.__chatQuestionsLoaded
  )
    return;
  globalThis.__chatQuestionsLoaded = true;
  const { KEY, THEME, SETTINGS, settingsFrom, question, source } =
    ChatQuestions;
  const selector = "yt-live-chat-text-message-renderer";
  const processed = new WeakMap();
  let queued = false,
    records = [],
    settings = settingsFrom();
  const style = document.createElement("style");
  function applyStyle() {
    style.textContent = `${selector}.question-highlight{background:${settings.color}20!important;border-inline-start:3px solid ${settings.color}!important;border-radius:6px!important;box-sizing:border-box}${selector}.question-answered{border-inline-start-color:#5d9e85!important;background:rgba(93,158,133,.08)!important}`;
  }
  applyStyle();
  document.documentElement.append(style);
  const panel = ChatQuestions.createPanel({
    getSettings: () => settings,
    getRecords: () => records,
    onAction: async (action, extra) => {
      const result = await chrome.runtime.sendMessage({
        type: "questions:action",
        action,
        ...extra,
      });
      if (result?.questions) records = result.questions;
      return result;
    },
  });
  function decorate() {
    for (const msg of document.querySelectorAll(selector)) {
      const saved = records.find(
        (q) =>
          q.sourceId &&
          q.sourceId === msg.id &&
          source(q.url) === source(location.href),
      );
      const text = (msg.querySelector("#message")?.textContent || "").trim();
      const visible =
        settings.enabled &&
        settings.highlight &&
        (settings.includeReplay || !location.pathname.endsWith("_replay")) &&
        question(text, settings) &&
        text.length <= settings.maxLength &&
        (processed.get(msg) === text || !!saved);
      msg.classList.toggle("question-highlight", visible);
      msg.classList.toggle("question-answered", visible && !!saved?.isRead);
    }
    panel.update();
  }
  async function scan() {
    queued = false;
    if (
      !settings.enabled ||
      (!settings.includeReplay && location.pathname.endsWith("_replay"))
    ) {
      decorate();
      return;
    }
    for (const msg of document.querySelectorAll(selector)) {
      const text = (msg.querySelector("#message")?.textContent || "").trim();
      if (
        !text ||
        text.length > settings.maxLength ||
        !question(text, settings) ||
        processed.get(msg) === text
      )
        continue;
      const author = (
        msg.querySelector("#author-name")?.textContent || ""
      ).trim();
      try {
        const result = await chrome.runtime.sendMessage({
          type: "questions:action",
          action: "add",
          item: { text, author, sourceId: msg.id || "", url: location.href },
        });
        if (result?.ok) {
          processed.set(msg, text);
          msg.classList.add("question-highlight");
          records = result.questions;
        }
      } catch {
        /* Reload tabs after an extension update. */
      }
    }
    decorate();
  }
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(scan, 100);
  }
  const observer = new MutationObserver((changes) => {
    if (
      changes.some(
        (change) =>
          change.type === "characterData" ||
          [...change.addedNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE ||
              node.matches?.(selector) ||
              node.querySelector?.(selector) ||
              node.parentElement?.closest(selector),
          ),
      )
    )
      schedule();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[SETTINGS]) {
      settings = settingsFrom(changes[SETTINGS].newValue);
      applyStyle();
      decorate();
      schedule();
    }
    if (changes[KEY]) {
      records = changes[KEY].newValue || [];
      decorate();
    }
  });
  chrome.runtime
    .sendMessage({ type: "questions:action", action: "get" })
    .then((result) => {
      if (!result?.ok) return;
      settings = result.settings;
      records = result.questions;
      applyStyle();
      panel.update();
      scan();
    })
    .catch(() => {});
})();
