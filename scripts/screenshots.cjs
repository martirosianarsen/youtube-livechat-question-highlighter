const { chromium } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const out = path.resolve(process.argv[2] || "dist");
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:8766/preview.html");
  const popup = page.frameLocator('iframe[title="Question queue preview"]');
  const chat = page.frameLocator('iframe[title="Tabbed YouTube chat preview"]');
  await popup
    .getByRole("button", { name: "Open settings", exact: true })
    .waitFor();
  await chat.getByRole("tab", { name: /Questions/ }).waitFor();
  await page.screenshot({
    path: path.join(out, "live-chat-preview-light.png"),
  });
  await page
    .locator('iframe[title="Question queue preview"]')
    .screenshot({ path: path.join(out, "live-chat-popup-light.png") });
  await chat.getByRole("tab", { name: "Live chat", exact: true }).click();
  await page.screenshot({ path: path.join(out, "live-chat-tabs.png") });
  await chat.getByRole("tab", { name: /Questions/ }).click();
  const opened = page.context().waitForEvent("page");
  await popup
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  const settings = await opened;
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .waitFor({ state: "visible" });
  await settings.setViewportSize({width:1280,height:1100});
  await settings.locator("main").screenshot({
    path: path.join(out, "live-chat-settings.png"),
  });
  await settings.getByLabel("Theme", { exact: true }).selectOption("dark");
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await settings
    .getByRole("status")
    .filter({ hasText: "Settings saved" })
    .waitFor();
  await popup.locator("body.dark").waitFor();
  await page.screenshot({ path: path.join(out, "live-chat-preview-dark.png") });
  await page
    .locator('iframe[title="Question queue preview"]')
    .screenshot({ path: path.join(out, "live-chat-popup-dark.png") });
  await fs.copyFile(
    "icons/YT_LC_QH_128.png",
    path.join(out, "live-chat-logo-128.png"),
  );
  await fs.copyFile("icons/logo.svg", path.join(out, "live-chat-logo.svg"));
  await browser.close();
})();
