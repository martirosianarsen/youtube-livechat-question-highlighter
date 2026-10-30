(() => {
  const KEY = "highlightedQuestions",
    THEME = "questionHighlighterTheme",
    SETTINGS = "questionHighlighterSettings";
  const DEFAULTS = {
    enabled: true,
    embedded: true,
    highlight: true,
    color: "#ee765d",
    theme: "system",
    maxQuestions: 100,
    maxLength: 1000,
    detectStarters: true,
    includeReplay: true,
    keywords: "",
  };
  function settingsFrom(value, legacyTheme) {
    const input = value && typeof value === "object" ? value : {};
    const next = { ...DEFAULTS };
    for (const key of [
      "enabled",
      "embedded",
      "highlight",
      "detectStarters",
      "includeReplay",
    ])
      if (typeof input[key] === "boolean") next[key] = input[key];
    if (/^#[0-9a-f]{6}$/i.test(input.color)) next.color = input.color;
    if (["system", "light", "dark"].includes(input.theme))
      next.theme = input.theme;
    else if (["light", "dark"].includes(legacyTheme)) next.theme = legacyTheme;
    if (
      Number.isInteger(input.maxQuestions) &&
      input.maxQuestions >= 0 &&
      input.maxQuestions <= 10000
    )
      next.maxQuestions = input.maxQuestions;
    if (
      Number.isInteger(input.maxLength) &&
      input.maxLength >= 100 &&
      input.maxLength <= 10000
    )
      next.maxLength = input.maxLength;
    if (typeof input.keywords === "string")
      next.keywords = input.keywords.slice(0, 2000);
    return next;
  }
  function question(text, settings = DEFAULTS) {
    if (typeof text !== "string") return false;
    if (/[¿?՞؟？]/u.test(text)) return true;
    const trimmed = text.trim();
    if (
      settings.detectStarters &&
      /^(հարց|ինչու|ինչպես|որքան|вопрос|question|what|how|why|when|where|who|which|can|could|would|should|will|do|does|did|is|are|was|were|have|has|had)\s+/iu.test(
        trimmed,
      )
    )
      return true;
    const lower = trimmed.toLocaleLowerCase();
    return settings.keywords
      .split("\n")
      .map((word) => word.trim().toLocaleLowerCase())
      .filter(Boolean)
      .some(
        (word) =>
          lower === word ||
          lower.startsWith(word + " ") ||
          lower.startsWith(word + ":"),
      );
  }
  function source(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== "https:" || u.hostname !== "www.youtube.com")
        return "";
      if (u.pathname === "/watch" && u.searchParams.get("v"))
        return `https://www.youtube.com/watch?v=${encodeURIComponent(u.searchParams.get("v"))}`;
      if (
        /^\/live_chat(?:_replay)?$/.test(u.pathname) &&
        u.searchParams.get("v")
      )
        return `https://www.youtube.com/watch?v=${encodeURIComponent(u.searchParams.get("v"))}`;
    } catch {}
    return "";
  }
  function normalize(raw) {
    return (Array.isArray(raw) ? raw : []).flatMap((item) => {
      if (typeof item === "string") item = { text: item };
      if (!item || typeof item.text !== "string" || !item.text.trim())
        return [];
      return [
        {
          ...item,
          id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
          text: item.text,
          isRead: !!item.isRead,
        },
      ];
    });
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;left:-9999px";
      document.body.append(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      if (!ok) throw new Error("Copy unavailable");
    }
  }
  globalThis.ChatQuestions = {
    KEY,
    THEME,
    SETTINGS,
    DEFAULTS,
    settingsFrom,
    question,
    source,
    normalize,
    copy,
  };
})();
