import { Cheerio, load } from "cheerio";
import type { AnyNode } from "domhandler";

interface ScrapeOptions {
  includeTags?: string[];
  excludeTags?: string[];
  onlyMainContent?: boolean;
}

const excludeNonMainTags = [
  "header",
  "footer",
  "nav",
  "aside",
  ".header",
  ".top",
  ".navbar",
  "#header",
  ".footer",
  ".bottom",
  "#footer",
  ".sidebar",
  ".side",
  ".aside",
  "#sidebar",
  ".modal",
  ".popup",
  "#modal",
  ".overlay",
  ".ad",
  ".ads",
  ".advert",
  "#ad",
  ".lang-selector",
  ".language",
  "#language-selector",
  ".social",
  ".social-media",
  ".social-links",
  "#social",
  ".menu",
  ".navigation",
  "#nav",
  ".breadcrumbs",
  "#breadcrumbs",
  "#search-form",
  ".search",
  "#search",
  ".share",
  "#share",
  ".widget",
  "#widget",
  ".cookie",
  "#cookie",
];

const forceIncludeMainTags = ["#main"];

const removeUnwantedElements = (html: string, scrapeOptions: ScrapeOptions) => {
  const soup = load(html);

  if (
    scrapeOptions.includeTags &&
    scrapeOptions.includeTags.filter((x) => x.trim().length !== 0).length > 0
  ) {
    // Create a new root element to hold the tags to keep
    const newRoot = load("<div></div>")("div");
    scrapeOptions.includeTags.forEach((tag) => {
      soup(tag).each((_, element) => {
        newRoot.append(soup(element).clone());
      });
    });
    return newRoot.html() ?? "";
  }

  soup("script, style, noscript, meta, head").remove();

  if (
    scrapeOptions.excludeTags &&
    scrapeOptions.excludeTags.filter((x) => x.trim().length !== 0).length > 0
  ) {
    scrapeOptions.excludeTags.forEach((tag) => {
      let elementsToRemove: Cheerio<AnyNode>;
      if (tag.startsWith("*") && tag.endsWith("*")) {
        let classMatch = false;

        const regexPattern = new RegExp(tag.slice(1, -1), "i");
        elementsToRemove = soup("*").filter((i, element) => {
          if (element.type === "tag") {
            const attributes = element.attribs;
            const tagNameMatches = regexPattern.test(element.name);
            const attributesMatch = Object.keys(attributes).some((attr) =>
              regexPattern.test(`${attr}="${attributes[attr]}"`)
            );
            if (tag.startsWith("*.")) {
              classMatch = Object.keys(attributes).some((attr) =>
                regexPattern.test(`class="${attributes[attr]}"`)
              );
            }
            return tagNameMatches || attributesMatch || classMatch;
          }
          return false;
        });
      } else {
        elementsToRemove = soup(tag);
      }
      elementsToRemove.remove();
    });
  }

  if (scrapeOptions.onlyMainContent) {
    excludeNonMainTags.forEach((tag) => {
      const elementsToRemove = soup(tag).filter(
        forceIncludeMainTags.map((x) => ":not(:has(" + x + "))").join("")
      );

      elementsToRemove.remove();
    });
  }

  const cleanedHtml = soup.html();
  return cleanedHtml;
};

export function extractText(html: string, options: ScrapeOptions = {}) {
  let title = load(html)('meta[property="og:title"]').attr("content");
  const cleanedHtml = removeUnwantedElements(html, options);
  const $ = load(cleanedHtml);

  let allText = "";

  $("*").each((_, element) => {
    if (element.type === "text") {
      allText += $(element).text().trim() + "\n";
    }
    if (
      element.type === "tag" &&
      [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "blockquote",
        "pre",
        "code",
        "td",
        "th",
      ].includes(element.name)
    ) {
      allText += $(element).text().trim() + "\n";
    }
  });

  const normalizedText = allText.replace(/\s+/g, " ").trim();
  return {
    cleanedText: normalizedText,
    title: title || "",
  };
}

export const getLinks = (
  strict: boolean = true,
  htmlContent: string,
  baseUrl: string
) => {
  const $ = load(htmlContent);
  const ignoreSelector = `:not([href$=".png"]):not([href$=".jpg"]):not([href$=".mp4"]):not([href$=".mp3"]):not([href$=".gif"])`;
  const links = $(
    `a[href^="/"]${ignoreSelector},a[href^="${baseUrl}"]${ignoreSelector}`
  )
    .filter((_, element) => {
      return (
        $(element).attr("href") !== "" && $(element).text().trim().length > 0
      );
    })
    .map((_, element) => {
      const url = new URL(element.attribs.href, baseUrl);
      return {
        url: url.href,
        text: $(element).text().trim(),
        hostname: url.hostname,
        pathname: url.pathname,
      };
    })
    .filter((_, link) => {
      const currentUrl = new URL(baseUrl);
      const basePath = currentUrl.pathname.endsWith("/")
        ? currentUrl.pathname
        : currentUrl.pathname + "/";
      // If strictFilter is true, only allow links that start with the base path.
      // Example:
      // For URL: https://orm.drizzle.team/docs/overview
      // Allowed links:
      // - /docs/overview
      // - /docs/overview/xyz
      // Disallowed links:
      // - /docs/guides
      if (strict) {
        return (
          link.hostname === currentUrl.hostname &&
          link.pathname.startsWith(basePath) &&
          link.pathname !== currentUrl.pathname
        );
      }

      // If strictFilter is false, allow all links that are not the same as the current URL.
      // Example:
      // For URL: https://orm.drizzle.team/docs/overview
      // Allowed links:
      // - /docs/overview
      // - /docs/overview/xyz
      // - /docs/guides
      // - /drizzle-studio/overview
      return (
        link.hostname === currentUrl.hostname &&
        link.pathname !== currentUrl.pathname
      );
    });

  return links.get();
};
