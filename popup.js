"use strict";
const { KEY, THEME, SETTINGS, settingsFrom, source, copy } = ChatQuestions,
  $ = (id) => document.getElementById(id);
let questions = [],
  filter = "unread";
const icons = {
  check: '<path d="m5 12 4 4L19 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  link: '<path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/>',
  delete: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7m4-7v7"/>',
};
function svg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
}
function status(text) {
  $("status").textContent = text;
  $("status").hidden = !text;
}
async function act(action, extra = {}) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "questions:action",
      action,
      ...extra,
    });
    if (!response?.ok) throw new Error();
    questions = response.questions;
    if (response.settings) applySettings(response.settings);
    render();
    return true;
  } catch {
    status("Could not save changes. Please reopen the popup and try again.");
    return false;
  }
}
function render() {
  const unread = questions.filter((q) => !q.isRead).length;
  $("pendingCount").textContent = unread;
  $("unreadCount").textContent = unread;
  $("answeredCount").textContent = questions.length - unread;
  $("clear").disabled = !questions.length;
  $("listLabel").textContent =
    filter === "unread"
      ? "WAITING FOR AN ANSWER"
      : filter === "answered"
        ? "ALREADY ANSWERED"
        : "ALL SAVED QUESTIONS";
  for (const id of ["unread", "answered", "all"]) {
    $(id).setAttribute("aria-selected", String(filter === id));
    $(id).tabIndex = filter === id ? 0 : -1;
  }
  $("questions").setAttribute("aria-labelledby", filter);
  $("questions").replaceChildren();
  const search = $("search").value.trim().toLocaleLowerCase();
  const visible = questions
    .filter(
      (q) =>
        (filter === "all" || (filter === "answered" ? q.isRead : !q.isRead)) &&
        `${q.text} ${q.author || ""}`.toLocaleLowerCase().includes(search),
    )
    .slice()
    .reverse();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "?";
    const title = document.createElement("h3");
    title.textContent = search
      ? "No matching questions"
      : filter === "answered"
        ? "No answers marked yet"
        : filter === "unread" && questions.length
          ? "You’re all caught up"
          : "Your next conversation starts here";
    const hint = document.createElement("p");
    hint.textContent = search
      ? "Try a different word or viewer name."
      : filter === "answered"
        ? "Mark a question as answered to find it here."
        : "Open a YouTube live stream with live chat. Questions will appear here automatically.";
    empty.append(icon, title, hint);
    $("questions").append(empty);
  }
  for (const q of visible) {
    const card = document.createElement("article");
    card.className = `question${q.isRead ? " answered" : ""}`;
    const head = document.createElement("div");
    head.className = "question-head";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = (q.author || "?").slice(0, 2).toUpperCase();
    const author = document.createElement("span");
    author.className = "author";
    author.textContent = q.author || "Viewer question";
    const time = document.createElement("span");
    time.className = "time";
    const date = new Date(q.timestamp);
    time.textContent = Number.isFinite(date.getTime())
      ? date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    head.append(avatar, author, time);
    const text = document.createElement("p");
    text.className = "question-text";
    text.textContent = q.text;
    const bottom = document.createElement("div");
    bottom.className = "question-bottom";
    const toggle = document.createElement("button");
    toggle.className = "read-toggle";
    toggle.setAttribute("aria-pressed", String(q.isRead));
    toggle.setAttribute(
      "aria-label",
      `${q.isRead ? "Mark unanswered" : "Mark answered"}: ${q.text}`,
    );
    toggle.innerHTML = svg("check");
    toggle.append(
      document.createTextNode(q.isRead ? "Answered" : "Mark answered"),
    );
    toggle.onclick = () => act("toggle", { id: q.id });
    const actions = document.createElement("div");
    actions.className = "actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "icon";
    copyBtn.title = "Copy question";
    copyBtn.setAttribute("aria-label", `Copy question: ${q.text}`);
    copyBtn.innerHTML = svg("copy");
    copyBtn.onclick = async () => {
      try {
        await copy(q.text);
        status("Question copied.");
      } catch {
        status("Could not copy. Please try again.");
      }
    };
    actions.append(copyBtn);
    const url = source(q.url);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "icon";
      link.title = "Open stream";
      link.setAttribute("aria-label", "Open source stream");
      link.innerHTML = svg("link");
      actions.append(link);
    }
    const remove = document.createElement("button");
    remove.className = "icon";
    remove.title = "Remove question";
    remove.setAttribute("aria-label", `Delete question: ${q.text}`);
    remove.innerHTML = svg("delete");
    remove.onclick = () => act("delete", { id: q.id });
    actions.append(remove);
    bottom.append(toggle, actions);
    card.append(head, text, bottom);
    $("questions").append(card);
  }
}
for (const id of ["unread", "answered", "all"]) {
  $(id).onclick = () => {
    filter = id;
    $("confirmation").hidden = true;
    render();
  };
  $(id).onkeydown = (event) => {
    const ids = ["unread", "answered", "all"];
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    filter =
      event.key === "Home"
        ? ids[0]
        : event.key === "End"
          ? ids[2]
          : ids[
              (ids.indexOf(filter) + (event.key === "ArrowRight" ? 1 : 2)) % 3
            ];
    $("confirmation").hidden = true;
    render();
    $(filter).focus();
  };
}
$("search").oninput = render;
$("clear").onclick = () => {
  $("confirmation").hidden = false;
  $("cancel").focus();
};
$("cancel").onclick = () => {
  $("confirmation").hidden = true;
  $("clear").focus();
};
$("confirm").onclick = async () => {
  $("confirm").disabled = true;
  if (await act("clear")) {
    $("confirmation").hidden = true;
    status("Question queue cleared.");
    $(filter).focus();
  }
  $("confirm").disabled = false;
};
let currentSettings = settingsFrom();
function applySettings(settings) {
  currentSettings = settings;
  const dark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
  $("limitLabel").textContent =
    `${settings.enabled ? "Saved on this device" : "Detection paused"} · ${settings.maxQuestions ? `latest ${settings.maxQuestions}` : "no fixed limit"}`;
}
$("settings").onclick = () => chrome.runtime.openOptionsPage();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () =>
  applySettings(currentSettings),
);
chrome.storage.local
  .get([SETTINGS, THEME])
  .then((stored) =>
    applySettings(settingsFrom(stored[SETTINGS], stored[THEME])),
  )
  .catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[KEY]) {
    questions = changes[KEY].newValue || [];
    render();
  }
  if (changes[SETTINGS])
    applySettings(settingsFrom(changes[SETTINGS].newValue));
});
act("get");
