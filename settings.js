"use strict";
const { KEY, THEME, SETTINGS, DEFAULTS, settingsFrom } = ChatQuestions;
const $ = (id) => document.getElementById(id);
const booleans = [
  "enabled",
  "embedded",
  "highlight",
  "detectStarters",
  "includeReplay",
];
let initialized = false;
function values() {
  return settingsFrom({
    ...Object.fromEntries(booleans.map((key) => [key, $(key).checked])),
    color: $("color").value,
    theme: $("theme").value,
    maxQuestions: Number($("maxQuestions").value),
    maxLength: Number($("maxLength").value),
    keywords: $("keywords").value,
  });
}
function appearance() {
  const selected = $("theme").value;
  document.body.classList.toggle(
    "dark",
    selected === "dark" ||
      (selected === "system" &&
        matchMedia("(prefers-color-scheme: dark)").matches),
  );
  $("sample").style.borderLeftColor = $("color").value;
  $("sample").style.backgroundColor = $("color").value + "20";
}
function render(settings) {
  for (const key of booleans) $(key).checked = settings[key];
  for (const key of ["color", "theme", "maxQuestions", "maxLength", "keywords"])
    $(key).value = settings[key];
  appearance();
}
$("save").disabled = true;
chrome.storage.local
  .get([SETTINGS, THEME])
  .then((stored) => {
    render(settingsFrom(stored[SETTINGS], stored[THEME]));
    initialized = true;
    $("save").disabled = false;
  })
  .catch(() => {
    $("settingsStatus").textContent =
      "Could not load your settings. Reopen this page to try again.";
  });
$("form").addEventListener("input", () => {
  appearance();
  $("settingsStatus").textContent = "Unsaved changes";
});
$("reset").onclick = () => {
  render(DEFAULTS);
  $("settingsStatus").textContent =
    "Defaults selected. Choose Save settings to apply.";
};
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  appearance,
);
$("form").onsubmit = async (event) => {
  event.preventDefault();
  if (!initialized || !$("form").reportValidity()) return;
  const settings = values();
  $("save").disabled = true;
  try {
    const list = (await chrome.storage.local.get(KEY))[KEY] || [];
    if (
      settings.maxQuestions &&
      list.length > settings.maxQuestions &&
      !window.confirm(
        `Keep only the newest ${settings.maxQuestions} questions? ${list.length - settings.maxQuestions} older saved questions will be permanently removed.`,
      )
    ) {
      $("settingsStatus").textContent = "Changes have not been saved.";
      return;
    }
    const response = await chrome.runtime.sendMessage({
      type: "questions:action",
      action: "settings",
      settings,
    });
    if (!response?.ok) throw new Error();
    render(response.settings);
    $("settingsStatus").textContent =
      "Settings saved. Open chat tabs have been updated.";
  } catch {
    $("settingsStatus").textContent =
      "Could not save settings. Please try again.";
  } finally {
    $("save").disabled = false;
  }
};
