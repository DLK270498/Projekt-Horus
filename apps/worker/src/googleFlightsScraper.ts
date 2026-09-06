import { chromium } from "playwright";

/**
 * Best-effort Google Flights scraper. Google Flights has no public API and
 * obfuscates its CSS class names, so this deliberately drives the UI via
 * role/placeholder locators (aria-labels are comparatively stable) instead
 * of brittle class selectors.
 *
 * NOT YET VERIFIED LIVE: this session's network policy blocks external
 * sites (see project notes), so this has only been written against known
 * Google Flights UI conventions, not run against the live page. Expect to
 * spend real iteration time on selectors once network access is available
 * — that cost is already accounted for in the project plan's risk section.
 */

export type GoogleFlightsQuery = {
  originQuery: string; // human-readable, e.g. "Frankfurt"
  destinationQuery: string; // e.g. "New York"
};

export type GoogleFlightsResult = {
  price: number;
  currency: "EUR";
  resultUrl: string;
};

const PRICE_PATTERN = /€\s?(\d{1,3}(?:\.\d{3})*)/;

// The playwright npm package version and the pre-installed browser revision
// can drift apart in this environment (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
// means we never fetch a matching one), so pin the executable explicitly
// instead of relying on playwright's version-based auto-detection.
const CHROMIUM_EXECUTABLE_PATH = "/opt/pw-browsers/chromium";

export async function scrapeGoogleFlightsBusinessClass(
  query: GoogleFlightsQuery,
): Promise<GoogleFlightsResult | null> {
  // Respect an HTTPS_PROXY if one is configured (true in this sandbox; not
  // expected in real deployment) rather than hardcoding a proxy dependency.
  const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_EXECUTABLE_PATH,
    proxy: proxyServer ? { server: proxyServer } : undefined,
  });

  try {
    const context = await browser.newContext({
      locale: "de-DE",
      // The sandbox proxy re-terminates TLS with its own CA, which Chromium
      // doesn't otherwise trust; harmless to also set this in a real,
      // proxy-less deployment.
      ignoreHTTPSErrors: Boolean(proxyServer),
    });
    const page = await context.newPage();

    await page.goto("https://www.google.com/travel/flights", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    const consentButton = page.getByRole("button", { name: /Alle akzeptieren|Accept all/i });
    if (await consentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await consentButton.click();
    }

    const originField = page.getByPlaceholder(/Von wo\?|Where from\?/i);
    await originField.click();
    await originField.fill(query.originQuery);
    await page.getByRole("option").first().click();

    const destinationField = page.getByPlaceholder(/Wohin\?|Where to\?/i);
    await destinationField.click();
    await destinationField.fill(query.destinationQuery);
    await page.getByRole("option").first().click();

    await page.getByRole("combobox", { name: /Economy|Economy Class/i }).click();
    await page.getByRole("option", { name: /Business/i }).click();

    await page.getByRole("button", { name: /Suchen|Search/i }).click();
    await page.waitForSelector("text=/€\\s?\\d/", { timeout: 20_000 });

    const bodyText = await page.locator("body").innerText();
    const match = bodyText.match(PRICE_PATTERN);
    if (!match) return null;

    const price = Number.parseInt(match[1].replace(/\./g, ""), 10);
    return { price, currency: "EUR", resultUrl: page.url() };
  } finally {
    await browser.close();
  }
}
