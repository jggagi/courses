import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (!path.startsWith(root + "/") && path !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file = (await stat(path)).isDirectory()
      ? resolve(path, "index.html")
      : path;
    res.writeHead(200, {
      "content-type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const js = new Set();
  const errors = [];
  const external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith(".js")) js.add(url.pathname);
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin)
      external.push(request.url());
  });
  await page.goto(origin);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(
    [...js].filter((path) => /\/A\d\d-/.test(path)).length,
    0,
    "home must not fetch authored lesson modules",
  );
  const initialJS = [...js];
  const bytes = (
    await Promise.all(initialJS.map((path) => stat(resolve(root, "." + path))))
  ).reduce((sum, file) => sum + file.size, 0);
  assert.ok(bytes < 400_000, `initial JS budget exceeded: ${bytes}`);
  for (const id of ["A01-A", "A12-B"]) {
    await page.goto(`${origin}/#/lesson/${id}`);
    await page.getByLabel("我的开场预测", { exact: true }).waitFor();
  }
  assert.deepEqual(
    [...js]
      .filter((path) => /\/A\d\d-/.test(path))
      .map((path) => path.match(/\/(A\d\d)-/)[1])
      .sort(),
    ["A01", "A12"],
  );
  await page.goto(`${origin}/#/lab/LA06`);
  await page.getByRole("button", { name: "跳过预测", exact: true }).click();
  await page.getByRole("button", { name: "运行实验", exact: true }).click();
  await page.getByTestId("la06-results").waitFor();
  await page.goto(`${origin}/#/review`);
  await page.getByTestId("review-workbench").waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    `Production smoke passed: home ${bytes} JS bytes; A01/A12 loaded independently; LA06 and review functional; no external requests or page errors.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
