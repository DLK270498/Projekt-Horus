import Parser from "rss-parser";
import { prisma } from "./prisma.js";
import { extractDeal, type KnownAirline, type KnownAirport } from "./extraction/dealExtractor.js";
import type { Source } from "@horus/db";

const REQUEST_TIMEOUT_MS = 15_000;

// A generic bot User-Agent gets broadly blocked by basic WAF/Cloudflare
// rules regardless of intent; a realistic browser UA + standard headers is
// normal practice for reading public feeds/JSON and much less likely to be
// bucketed as "obviously a bot" by naive filters.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BROWSER_LIKE_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
};

const rssParser = new Parser({ timeout: REQUEST_TIMEOUT_MS, headers: BROWSER_LIKE_HEADERS });
// Fallback for feeds with malformed/HTML-ish XML (unquoted attributes etc.)
// that trip up strict XML parsing; only used when the strict parse fails.
const lenientRssParser = new Parser({
  timeout: REQUEST_TIMEOUT_MS,
  headers: BROWSER_LIKE_HEADERS,
  xml2js: { strict: false },
});

async function loadKnownReferenceData(): Promise<{ airlines: KnownAirline[]; airports: KnownAirport[] }> {
  const [airlines, airports] = await Promise.all([
    prisma.airline.findMany({
      where: { isActive: true },
      select: { id: true, iataCode: true, name: true },
    }),
    prisma.airport.findMany({ select: { id: true, iataCode: true } }),
  ]);
  return { airlines, airports };
}

async function persistObservation(
  sourceId: string,
  extracted: NonNullable<ReturnType<typeof extractDeal>>,
  sourceUrl: string,
) {
  await prisma.priceObservation.create({
    data: {
      airlineId: extracted.airlineId as string,
      originAirportId: extracted.originAirportId,
      destinationAirportId: extracted.destinationAirportId,
      sourceId,
      cabinClass: "BUSINESS",
      price: extracted.price,
      currency: extracted.currency,
      sourceUrl,
    },
  });
}

async function crawlRssFeed(source: Source, airlines: KnownAirline[], airports: KnownAirport[]) {
  let feed;
  try {
    feed = await rssParser.parseURL(source.baseUrl!);
  } catch (error) {
    // Real-world feeds sometimes embed unescaped HTML (unquoted attributes
    // etc.) that trips up strict XML parsing. Retry leniently before giving up.
    if ((error as Error).message.includes("Attribute without value") || (error as Error).message.includes("Invalid character")) {
      feed = await lenientRssParser.parseURL(source.baseUrl!);
    } else {
      throw error;
    }
  }

  let created = 0;

  for (const item of feed.items) {
    const text = `${item.title ?? ""} ${item.contentSnippet ?? item.content ?? ""}`;
    const extracted = extractDeal(text, airlines, airports);
    if (!extracted || !extracted.airlineId) continue;

    await persistObservation(source.id, extracted, item.link ?? source.baseUrl!);
    created++;
  }

  return created;
}

async function crawlRedditJson(source: Source, airlines: KnownAirline[], airports: KnownAirport[]) {
  const response = await fetch(source.baseUrl!, {
    headers: BROWSER_LIKE_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { children?: Array<{ data?: { title?: string; selftext?: string; permalink?: string } }> };
  };
  const posts = payload.data?.children ?? [];
  let created = 0;

  for (const post of posts) {
    const title = post.data?.title ?? "";
    const selftext = post.data?.selftext ?? "";
    const text = `${title} ${selftext}`;
    const extracted = extractDeal(text, airlines, airports);
    if (!extracted || !extracted.airlineId) continue;

    const sourceUrl = post.data?.permalink
      ? `https://www.reddit.com${post.data.permalink}`
      : source.baseUrl!;
    await persistObservation(source.id, extracted, sourceUrl);
    created++;
  }

  return created;
}

export type ForumCrawlResult = Record<string, number | { error: string }>;

/**
 * Crawls all active FORUM sources and persists extracted Business Class
 * deal candidates as PriceObservations. One source failing (blocked,
 * changed format, ...) never aborts the others.
 */
export async function runForumCrawlers(): Promise<ForumCrawlResult> {
  const sources = await prisma.source.findMany({ where: { isActive: true, type: "FORUM" } });
  const { airlines, airports } = await loadKnownReferenceData();

  const results: ForumCrawlResult = {};

  for (const source of sources) {
    if (!source.baseUrl) {
      results[source.name] = { error: "no baseUrl configured" };
      continue;
    }

    try {
      const isJsonFeed = source.baseUrl.includes(".json");
      const created = isJsonFeed
        ? await crawlRedditJson(source, airlines, airports)
        : await crawlRssFeed(source, airlines, airports);
      results[source.name] = created;
    } catch (error) {
      results[source.name] = { error: (error as Error).message };
    }
  }

  return results;
}
