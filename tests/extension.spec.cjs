const { test, expect, chromium } = require("@playwright/test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
let ctx, worker, id, profile;
const fixture =
  '<!doctype html><title>Live chat fixture</title><style>body{font:14px system-ui;background:#fff;color:#222}yt-live-chat-text-message-renderer{display:block;padding:12px}#author-name{font-weight:bold;margin-right:12px}</style><yt-live-chat-app><div id="items"></div><input id="composer" aria-label="Chat message" placeholder="Send a message"></yt-live-chat-app>';
test.beforeAll(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), "chat-qa-"));
  const extension = path.resolve(__dirname, "..");
  ctx = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await ctx.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: fixture }),
  );
  worker = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  id = new URL(worker.url()).host;
});
test.afterAll(async () => {
  await ctx?.close();
  await fs.rm(profile, { recursive: true, force: true });
});
test.beforeEach(async () => {
  await worker.evaluate(() => chrome.storage.local.clear());
});
async function stored() {
  return worker.evaluate(
    async () =>
      (await chrome.storage.local.get("highlightedQuestions"))
        .highlightedQuestions || [],
  );
}
async function chat(video = "a") {
  const p = await ctx.newPage();
  await p.goto(`https://www.youtube.com/live_chat?v=${video}`);
  return p;
}
async function popup() {
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${id}/popup.html`);
  return p;
}
async function append(p, messages) {
  await p.locator("#items").evaluate((el, list) => {
    for (const item of list) {
      const msg = document.createElement("yt-live-chat-text-message-renderer");
      msg.id = item.id;
      const author = document.createElement("span");
      author.id = "author-name";
      author.textContent = item.author || "Viewer";
      const text = document.createElement("span");
      text.id = "message";
      text.textContent = item.text;
      msg.append(author, text);
      el.append(msg);
    }
  }, messages);
}
test("recognizes questions in message text, including Armenian, without reading author names", async () => {
  const p = await chat();
  await append(p, [
    { id: "one", text: "How do I start?" },
    { id: "two", text: "Ինչպե՞ս է աշխատում" },
    { id: "three", author: "Why not?", text: "Great stream!" },
  ]);
  await expect.poll(async () => (await stored()).length).toBe(2);
  await expect(p.locator(".question-highlight")).toHaveCount(2);
  expect((await stored()).map((q) => q.text)).not.toContain(
    "Why not?Great stream!",
  );
  await p.close();
});
test("captures burst arrivals from multiple streams without losing or duplicating questions", async () => {
  const a = await chat("a"),
    b = await chat("b");
  await Promise.all([
    append(
      a,
      Array.from({ length: 12 }, (_, i) => ({
        id: `a${i}`,
        text: `Question ${i}?`,
      })),
    ),
    append(
      b,
      Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        text: `Question ${i}?`,
      })),
    ),
  ]);
  await expect.poll(async () => (await stored()).length).toBe(24);
  await a.reload();
  await append(a, [{ id: "a0", text: "Question 0?" }]);
  await expect(a.locator(".question-highlight")).toHaveCount(1);
  expect(await stored()).toHaveLength(24);
  await a.close();
  await b.close();
});
test("detects text nodes inserted into an existing renderer", async () => {
  const p = await chat();
  await append(p, [{ id: "late", text: "Loading" }]);
  await p
    .locator("#late #message")
    .evaluate((el) => (el.firstChild.data = "When will this ship?"));
  await expect.poll(async () => (await stored()).length).toBe(1);
  await p.close();
});
test("legacy strings and read flags migrate; search, filters and deletion remain usable", async () => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      highlightedQuestions: [
        "Old question?",
        { text: "Already read?", isRead: true, timestamp: 1 },
      ],
    }),
  );
  const p = await popup();
  await expect(p.locator(".question")).toHaveCount(1);
  await p.getByRole("tab", { name: "All", exact: true }).click();
  await expect(p.locator(".question")).toHaveCount(2);
  await p.getByRole("searchbox").fill("Old");
  await expect(p.locator(".question")).toHaveCount(1);
  await p
    .getByRole("button", { name: "Mark answered: Old question?", exact: true })
    .click();
  await expect(p.locator(".read-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await p.getByRole("tab", { name: /Answered/ }).click();
  await expect(p.locator(".question")).toHaveCount(1);
  await p.getByRole("searchbox").fill("");
  await expect(p.locator(".question")).toHaveCount(2);
  await p
    .getByRole("button", {
      name: "Delete question: Old question?",
      exact: true,
    })
    .click();
  await expect(p.locator(".question")).toHaveCount(1);
  await p.close();
});
test("answered state updates chat and other popup views, and can be reversed", async () => {
  const c = await chat();
  await append(c, [{ id: "answer", author: "Ani", text: "Can I try it?" }]);
  await expect.poll(async () => (await stored()).length).toBe(1);
  const a = await popup(),
    b = await popup();
  await a.getByRole("button", { name: /Mark answered:/ }).click();
  await expect(a.locator(".question")).toHaveCount(0);
  await expect(b.locator(".question")).toHaveCount(0);
  await expect(c.locator(".question-answered")).toHaveCount(1);
  await b.getByRole("tab", { name: /Answered/ }).click();
  await b.getByRole("button", { name: /Mark unanswered:/ }).click();
  await expect(c.locator(".question-answered")).toHaveCount(0);
  await expect(a.locator(".question")).toHaveCount(1);
  await a.close();
  await b.close();
  await c.close();
});
test("clear requires confirmation and cancellation keeps the queue", async () => {
  await worker.evaluate(() =>
    chrome.storage.local.set({ highlightedQuestions: ["Keep me?"] }),
  );
  const p = await popup();
  await p.getByRole("button", { name: "Clear queue", exact: true }).click();
  await p.getByRole("button", { name: "Keep questions", exact: true }).click();
  expect(await stored()).toHaveLength(1);
  await p.getByRole("button", { name: "Clear queue", exact: true }).click();
  await p
    .getByRole("button", { name: "Clear all questions", exact: true })
    .click();
  await expect(p.locator(".question")).toHaveCount(0);
  expect(await stored()).toHaveLength(0);
  await p.close();
});
test("theme persists and question text is safely rendered", async () => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      highlightedQuestions: [
        { text: "<img src=x onerror=alert(1)>?", url: "javascript:alert(1)" },
      ],
      questionHighlighterTheme: "light",
    }),
  );
  const p = await popup();
  await expect(p.locator(".question-text")).toHaveText(
    "<img src=x onerror=alert(1)>?",
  );
  await expect(p.locator(".question img")).toHaveCount(0);
  await expect(p.getByRole("link", { name: "Open source stream" })).toHaveCount(
    0,
  );
  const opened = ctx.waitForEvent("page");
  await p.getByRole("button", { name: "Open settings", exact: true }).click();
  const settings = await opened;
  await settings.waitForURL(`chrome-extension://${id}/settings.html`);
  await expect(settings.locator("#theme")).toHaveValue("light");
  await settings.getByLabel("Theme", { exact: true }).selectOption("dark");
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await expect(p.locator("body")).toHaveClass("dark");
  await p.reload();
  await expect(p.locator("body")).toHaveClass("dark");
  await settings.close();
  await p.close();
});
test("only the newest 100 records are kept and popup fits Chrome bounds", async () => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      highlightedQuestions: Array.from(
        { length: 110 },
        (_, i) => `Question ${i}?`,
      ),
    }),
  );
  const p = await popup();
  await expect(p.locator(".question")).toHaveCount(100);
  const list = await stored();
  expect(list).toHaveLength(100);
  expect(list[0].text).toBe("Question 10?");
  const box = await p.locator("body").boundingBox();
  expect(box.width).toBe(400);
  expect(box.height).toBeLessThanOrEqual(600);
  await p.close();
});

test("copies a question and offers a safe link back to its stream", async () => {
  const c = await chat("copy-test");
  await append(c, [{ id: "copy", text: "Where can I find the notes?" }]);
  await expect.poll(async () => (await stored()).length).toBe(1);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "https://www.youtube.com",
  });
  const p = await popup();
  await expect(
    p.getByRole("link", { name: "Open source stream" }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=copy-test");
  await p
    .getByRole("button", {
      name: "Copy question: Where can I find the notes?",
      exact: true,
    })
    .click();
  await expect(p.getByRole("status")).toHaveText("Question copied.");
  await c.bringToFront();
  expect(await c.evaluate(() => navigator.clipboard.readText())).toBe(
    "Where can I find the notes?",
  );
  await p.close();
  await c.close();
});

async function settingsPage() {
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${id}/settings.html`);
  await expect(
    p.getByRole("button", { name: "Save settings", exact: true }),
  ).toBeEnabled();
  return p;
}
test("settings control capture, custom starters, highlighting, and replay support live", async () => {
  const settings = await settingsPage();
  const c = await chat("settings");
  await settings.getByRole("switch", { name: /Capture questions/ }).uncheck();
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await append(c, [{ id: "paused", text: "Can you explain this?" }]);
  await expect(c.getByRole("status")).toContainText("Detection paused");
  expect(await stored()).toHaveLength(0);
  await settings.getByRole("switch", { name: /Capture questions/ }).check();
  await settings
    .getByRole("switch", { name: /Recognize question starters/ })
    .uncheck();
  await settings
    .getByLabel("Additional question starters", { exact: true })
    .fill("advice");
  await settings
    .getByLabel("Highlight accent color", { exact: true })
    .fill("#7b43bc");
  await settings
    .getByRole("switch", { name: /Include chat replays/ })
    .uncheck();
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await expect.poll(async () => (await stored()).length).toBe(1);
  await append(c, [
    { id: "plain", text: "How do I start" },
    { id: "custom", text: "advice for a new creator" },
  ]);
  await expect.poll(async () => (await stored()).length).toBe(2);
  await expect(c.locator("#custom")).toHaveCSS(
    "border-inline-start-color",
    "rgb(123, 67, 188)",
  );
  const replay = await ctx.newPage();
  await replay.goto("https://www.youtube.com/live_chat_replay?v=settings");
  await append(replay, [{ id: "replay", text: "When does it start?" }]);
  await expect(replay.locator("#replay")).not.toHaveClass(/question-highlight/);
  await settings.getByRole("switch", { name: /Include chat replays/ }).check();
  await settings
    .getByRole("switch", { name: /Highlight questions in chat/ })
    .uncheck();
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await expect.poll(async () => (await stored()).length).toBe(3);
  await expect(replay.locator("#replay")).not.toHaveClass(/question-highlight/);
  await settings.reload();
  await expect(
    settings.getByLabel("Additional question starters", { exact: true }),
  ).toHaveValue("advice");
  await settings
    .getByRole("button", { name: "Restore defaults", exact: true })
    .click();
  await expect(
    settings.getByLabel("Maximum saved questions", { exact: true }),
  ).toHaveValue("100");
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await c.close();
  await replay.close();
  await settings.close();
});
test("question count limit is configurable, unlimited preserves history, and reducing confirms deletion", async () => {
  await worker.evaluate(() =>
    chrome.storage.local.set({
      highlightedQuestions: Array.from(
        { length: 150 },
        (_, i) => `Saved ${i}?`,
      ),
      questionHighlighterSettings: { maxQuestions: 0 },
    }),
  );
  const p = await popup();
  await expect(p.locator(".question")).toHaveCount(150);
  await expect(p.locator("#limitLabel")).toContainText("no fixed limit");
  const settings = await settingsPage();
  await settings
    .getByLabel("Maximum saved questions", { exact: true })
    .fill("120");
  settings.once("dialog", (dialog) => dialog.dismiss());
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText(
    "have not been saved",
  );
  expect(await stored()).toHaveLength(150);
  settings.once("dialog", (dialog) => dialog.accept());
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await expect.poll(async () => (await stored()).length).toBe(120);
  await expect(p.locator("#limitLabel")).toContainText("latest 120");
  await settings.close();
  await p.close();
});
test("embedded tabs separate real native chat from this stream’s questions and restore the original layout", async () => {
  const c = await chat("panel");
  await append(c, [
    { id: "one", text: "What is next?" },
    { id: "two", text: "Hello everyone" },
  ]);
  await expect.poll(async () => (await stored()).length).toBe(1);
  await expect(c.getByRole("tab", { name: /Questions/ })).toBeVisible();
  await expect(
    c.getByRole("button", {
      name: "Mark answered: What is next?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(c.locator("#composer")).toBeHidden();
  await c.getByRole("tab", { name: "Live chat", exact: true }).click();
  await expect(c.locator("#composer")).toBeVisible();
  await expect(c.locator("#two")).toBeVisible();
  await c.locator("#composer").fill("My own message");
  await c.getByRole("tab", { name: /Questions/ }).click();
  await expect(c.locator("#composer")).toBeHidden();
  await c
    .getByRole("button", { name: "Mark answered: What is next?", exact: true })
    .click();
  await c.getByRole("button", { name: "Answered", exact: true }).click();
  await expect(
    c.getByRole("button", {
      name: "Mark unanswered: What is next?",
      exact: true,
    }),
  ).toBeVisible();
  await c.getByRole("tab", { name: "Live chat", exact: true }).click();
  await expect(c.locator("#composer")).toHaveValue("My own message");
  const settings = await settingsPage();
  await settings.getByRole("switch", { name: /Tabbed live chat/ }).uncheck();
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings.getByRole("status")).toContainText("Settings saved");
  await expect(
    c.getByRole("tab", { name: "Live chat", exact: true }),
  ).toBeHidden();
  await expect(c.locator("#composer")).toBeVisible();
  await expect(c.locator("body")).not.toHaveAttribute(
    "data-question-queue-tab",
    /./,
  );
  await settings.close();
  await c.close();
});
