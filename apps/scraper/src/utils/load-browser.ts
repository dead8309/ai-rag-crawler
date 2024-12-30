const CHROMIUM_PATH =
  "https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar";

export async function getBrowser() {
  if (process.env.VERCEL_ENV === "production") {
    const chromium = await import("@sparticuz/chromium-min").then(
      (mod) => mod.default
    );

    const puppeteerCore = await import("puppeteer-core").then(
      (mod) => mod.default
    );

    const executablePath = await chromium.executablePath(CHROMIUM_PATH);

    const browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: "shell",
    });
    return browser;
  } else {
    const puppeteer = await import("puppeteer-core").then((mod) => mod.default);
    const browser = await puppeteer.launch({
      executablePath:
        process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : process.platform === "linux"
          ? "/snap/bin/chromium"
          : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });
    return browser;
  }
}
