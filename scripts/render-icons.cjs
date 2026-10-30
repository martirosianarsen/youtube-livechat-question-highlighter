const { chromium } = require("@playwright/test");
const fs = require("node:fs/promises");
(async () => {
  const browser = await chromium.launch({
    channel: "chromium",
    headless: true,
  });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svg = await fs.readFile("icons/logo.svg", "utf8");
  for (const size of [16, 19, 32, 38, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({
      path: `icons/YT_LC_QH_${size}.png`,
      omitBackground: true,
    });
  }
  await browser.close();
})();
