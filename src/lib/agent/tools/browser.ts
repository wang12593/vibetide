import type { Browser, Page } from "puppeteer-core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

type ActionResult = {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
  screenshot?: string;
  url?: string;
  title?: string;
};

let _browser: Browser | null = null;
let _page: Page | null = null;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getChromiumPath(): string {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const { existsSync } = require("fs");
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return "";
}

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;

  const puppeteer = await import("puppeteer-core");
  const chromiumPath = getChromiumPath();
  if (!chromiumPath) {
    throw new Error(
      "未找到 Chrome/Chromium 浏览器。请设置 CHROMIUM_PATH 环境变量指向浏览器可执行文件路径。"
    );
  }

  _browser = await puppeteer.default.launch({
    executablePath: chromiumPath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,800",
    ],
  });

  _browser.on("disconnected", () => {
    _browser = null;
    _page = null;
  });

  return _browser;
}

async function getPage(): Promise<Page> {
  if (_page && !_page.isClosed()) return _page;
  const browser = await getBrowser();
  _page = await browser.newPage();
  await _page.setViewport({ width: 1280, height: 800 });
  await _page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  return _page;
}

async function pageMeta(page: Page) {
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
  };
}

async function takeScreenshot(page: Page): Promise<string> {
  const buf = await page.screenshot({ type: "png", encoding: "base64" });
  return `data:image/png;base64,${buf}`;
}

export async function browserNavigate(url: string): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(1500);
    const meta = await pageMeta(page);
    return {
      success: true,
      action: "navigate",
      url: meta.url,
      title: meta.title,
      screenshot: await takeScreenshot(page),
      data: { url: meta.url, title: meta.title },
    };
  } catch (e: unknown) {
    return { success: false, action: "navigate", error: String((e as Error).message) };
  }
}

export async function browserScreenshot(
  saveToPath?: string
): Promise<ActionResult> {
  try {
    const page = await getPage();
    const meta = await pageMeta(page);
    const base64 = await takeScreenshot(page);

    let savedPath: string | undefined;
    let accessUrl: string | undefined;
    if (saveToPath) {
      const resolvedPath = resolveFilePath(saveToPath, `screenshot_${Date.now()}.png`);
      mkdirSync(dirname(resolvedPath), { recursive: true });
      const pureBase64 = base64.replace(/^data:image\/png;base64,/, "");
      writeFileSync(resolvedPath, Buffer.from(pureBase64, "base64"));
      savedPath = resolvedPath;
      const rel = resolvedPath.replace(/\\/g, "/").split("/public/")[1] || "";
      accessUrl = `/${rel}`;
    }

    return {
      success: true,
      action: "screenshot",
      url: meta.url,
      title: meta.title,
      screenshot: base64,
      data: { url: meta.url, title: meta.title, savedPath, accessUrl },
    };
  } catch (e: unknown) {
    return { success: false, action: "screenshot", error: String((e as Error).message) };
  }
}

const PROJECT_ROOT = join(process.cwd(), "..");
const SCREENSHOTS_DIR = join(PROJECT_ROOT, "vibetide", "public", "screenshots");

function resolveFilePath(inputPath: string | undefined, fallbackName: string): string {
  if (inputPath) {
    const expanded = inputPath.replace(/^~/, homedir());
    if (!expanded.includes(":") && !expanded.startsWith("/")) {
      return join(SCREENSHOTS_DIR, expanded);
    }
    return expanded;
  }
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  return join(SCREENSHOTS_DIR, fallbackName);
}

export async function browserSaveScreenshot(
  filePath: string
): Promise<ActionResult> {
  try {
    const page = await getPage();
    const meta = await pageMeta(page);
    const resolvedPath = resolveFilePath(filePath, `screenshot_${Date.now()}.png`);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    await page.screenshot({ type: "png", path: resolvedPath });
    const relativePath = resolvedPath.replace(/\\/g, "/").split("/public/")[1] || resolvedPath;
    const accessUrl = `/screenshots/${relativePath.split("/screenshots/")[1] || ""}`;
    return {
      success: true,
      action: "save_screenshot",
      url: meta.url,
      title: meta.title,
      screenshot: await takeScreenshot(page),
      data: { url: meta.url, title: meta.title, savedPath: resolvedPath, accessUrl },
    };
  } catch (e: unknown) {
    return { success: false, action: "save_screenshot", error: String((e as Error).message) };
  }
}

export async function browserFill(
  selector: string,
  value: string
): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector, { clickCount: 3 });
    await page.type(selector, value, { delay: 50 });
    const meta = await pageMeta(page);
    return {
      success: true,
      action: "fill",
      url: meta.url,
      screenshot: await takeScreenshot(page),
      data: { selector, value },
    };
  } catch (e: unknown) {
    return { success: false, action: "fill", error: String((e as Error).message) };
  }
}

export async function browserClick(selector: string): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector);
    await delay(1000);
    const meta = await pageMeta(page);
    return {
      success: true,
      action: "click",
      url: meta.url,
      title: meta.title,
      screenshot: await takeScreenshot(page),
      data: { selector },
    };
  } catch (e: unknown) {
    return { success: false, action: "click", error: String((e as Error).message) };
  }
}

export async function browserSelect(
  selector: string,
  value: string
): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.select(selector, value);
    await delay(500);
    const meta = await pageMeta(page);
    return {
      success: true,
      action: "select",
      url: meta.url,
      screenshot: await takeScreenshot(page),
      data: { selector, value },
    };
  } catch (e: unknown) {
    return { success: false, action: "select", error: String((e as Error).message) };
  }
}

export async function browserSubmit(selector?: string): Promise<ActionResult> {
  try {
    const page = await getPage();
    if (selector) {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.click(selector);
    } else {
      await page.keyboard.press("Enter");
    }
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await delay(1000);
    const meta = await pageMeta(page);
    return {
      success: true,
      action: "submit",
      url: meta.url,
      title: meta.title,
      screenshot: await takeScreenshot(page),
      data: { url: meta.url, title: meta.title },
    };
  } catch (e: unknown) {
    return { success: false, action: "submit", error: String((e as Error).message) };
  }
}

export async function browserGetText(selector: string): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.waitForSelector(selector, { timeout: 10000 });
    const text = await page.$eval(selector, (el) => el.textContent?.trim() ?? "");
    return {
      success: true,
      action: "get_text",
      data: { selector, text },
    };
  } catch (e: unknown) {
    return { success: false, action: "get_text", error: String((e as Error).message) };
  }
}

export async function browserWaitFor(
  selector: string,
  timeoutMs: number = 10000
): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.waitForSelector(selector, { timeout: timeoutMs });
    const meta = await pageMeta(page);
    return {
      success: true,
      action: "wait_for",
      url: meta.url,
      screenshot: await takeScreenshot(page),
      data: { selector },
    };
  } catch (e: unknown) {
    return { success: false, action: "wait_for", error: String((e as Error).message) };
  }
}

export async function browserClose(): Promise<ActionResult> {
  try {
    if (_page) {
      await _page.close().catch(() => {});
      _page = null;
    }
    if (_browser) {
      await _browser.close().catch(() => {});
      _browser = null;
    }
    return { success: true, action: "close" };
  } catch (e: unknown) {
    return { success: false, action: "close", error: String((e as Error).message) };
  }
}

export async function browserLogin(
  url: string,
  usernameSelector: string,
  passwordSelector: string,
  username: string,
  password: string,
  submitSelector?: string
): Promise<ActionResult> {
  try {
    const page = await getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(1500);

    await page.waitForSelector(usernameSelector, { timeout: 10000 });
    await page.click(usernameSelector, { clickCount: 3 });
    await page.type(usernameSelector, username, { delay: 50 });

    await page.waitForSelector(passwordSelector, { timeout: 10000 });
    await page.click(passwordSelector, { clickCount: 3 });
    await page.type(passwordSelector, password, { delay: 50 });

    if (submitSelector) {
      await page.click(submitSelector);
    } else {
      await page.keyboard.press("Enter");
    }

    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await delay(2000);

    const meta = await pageMeta(page);
    return {
      success: true,
      action: "login",
      url: meta.url,
      title: meta.title,
      screenshot: await takeScreenshot(page),
      data: { url: meta.url, title: meta.title },
    };
  } catch (e: unknown) {
    return { success: false, action: "login", error: String((e as Error).message) };
  }
}
