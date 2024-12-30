import { getBrowser } from "@/utils/load-browser";
import { NextRequest, NextResponse } from "next/server";
import { extractText, getLinks } from "@/utils/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ScraperType = "browser" | "fetch";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const urlQuery = searchParams.get("url");
    const strictFilter = Boolean(searchParams.get("strict") === "true");
    let type = searchParams.get("type") as ScraperType | null;
    if (!type) {
      type = "fetch";
    }

    if (!urlQuery) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    if (type === "fetch") {
      const response = await fetch(urlQuery);
      const htmlContent = await response.text();
      const cleanedText = extractText(htmlContent);
      const links = getLinks(strictFilter, htmlContent, urlQuery);

      return NextResponse.json(
        {
          data: cleanedText,
          total: links.length,
          links,
        },
        { status: 200 }
      );
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    const redirectPromise = page.waitForNavigation({
      waitUntil: ["load", "domcontentloaded", "networkidle0"],
    });

    await page.goto(urlQuery);

    await redirectPromise;

    const htmlContent = await page.content();
    const cleanedText = extractText(htmlContent);
    const links = getLinks(strictFilter, htmlContent, urlQuery);

    // const anchorElements = await page.$$eval("a", (links) => {
    //   return links
    //     .filter(
    //       (link) =>
    //         link.innerText.trim().length > 0 &&
    //         link.hash === "" &&
    //         link.href !== ""
    //     )
    //     .map((link) => {
    //       const url = new URL(link.href);
    //       return {
    //         url: url.href,
    //         text: link.innerText.trim(),
    //         hostname: url.hostname,
    //         pathname: url.pathname,
    //       };
    //     });
    // });
    //
    // const currentUrl = new URL(urlQuery);
    // const basePath = currentUrl.pathname.endsWith("/")
    //   ? currentUrl.pathname
    //   : currentUrl.pathname + "/";
    //
    // const nextLinks = anchorElements.filter((link) => {
    //   // If strictFilter is true, only allow links that start with the base path.
    //   // Example:
    //   // For URL: https://orm.drizzle.team/docs/overview
    //   // Allowed links:
    //   // - /docs/overview
    //   // - /docs/overview/xyz
    //   // Disallowed links:
    //   // - /docs/guides
    //   if (strictFilter) {
    //     return (
    //       link.hostname === currentUrl.hostname &&
    //       link.pathname.startsWith(basePath) &&
    //       link.pathname !== currentUrl.pathname
    //     );
    //   }
    //
    //   // If strictFilter is false, allow all links that are not the same as the current URL.
    //   // Example:
    //   // For URL: https://orm.drizzle.team/docs/overview
    //   // Allowed links:
    //   // - /docs/overview
    //   // - /docs/overview/xyz
    //   // - /docs/guides
    //   // - /drizzle-studio/overview
    //   return (
    //     link.hostname === currentUrl.hostname &&
    //     link.pathname !== currentUrl.pathname
    //   );
    // });

    await browser.close();
    return NextResponse.json(
      {
        data: cleanedText,
        total: links.length,
        links,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
