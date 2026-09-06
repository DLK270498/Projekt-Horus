import Parser from "rss-parser";
import { prisma } from "./prisma.js";
import { extractDeal, type KnownAirline, type KnownAirport } from "./extraction/dealExtractor.js";
import type { Source } from "@horus/db";

const REQUEST_TIMEOUT_MS = 15_000;

// A generic bot User-Agent gets broadly blocked by basic WAF/Cloudflare
// rules regardless of intent; a realistic browser UA + standard headers is
// normal practice for reading public feeds and much less likely to be
// bucketed as "obviously a bot" by naive filters.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BROWSER_LIKE_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
};

// rss-parser handles both RSS 2.0 and Atom (used by Reddit's .rss feeds)
// transparently, so one parser covers every source we crawl.
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
    prisma.airport.findMany({ select: { id: true, iataCode: true, city: true, country: true } }),
  ]);
  return { airlines, airports };
}

/**
 * Forum/deal-blog posts are already curated by a human/community as "this
 * is a deal" (that's the entire premise of e.g. r/flightdeals) — unlike a
 * raw Google Flights price crawl, there's no larger price history to
 * compare against yet. So we persist the observation AND immediately turn
 * it into a CANDIDATE deal, with discountPercent left at 0 until enough
 * history accumulates to compute a real baseline (see baseline.ts, which
 * only ever touches observations that don't already have a deal).
 */
async function persistCuratedDeal(
  sourceId: string,
  extracted: NonNullable<ReturnType<typeof extractDeal>>,
  sourceUrl: string,
): Promise<boolean> {
  // Feeds get re-crawled on every run and often return the same posts again
  // (especially a quiet subreddit); sourceUrl identifies the specific post,
  // so skip it if we've already turned it into an observation.
  const existing = await prisma.priceObservation.findFirst({ where: { sourceUrl } });
  if (existing) return false;

  const observation = await prisma.priceObservation.create({
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

  await prisma.deal.create({
    data: {
      priceObservationId: observation.id,
      baselinePrice: extracted.price,
      discountPercent: 0,
      status: "CANDIDATE",
      clickoutUrl: sourceUrl,
    },
  });

  return true;
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

    const wasNew = await persistCuratedDeal(source.id, extracted, item.link ?? source.baseUrl!);
    if (wasNew) created++;
  }

  return created;
}

export type ForumCrawlResult = Record<string, number | { error: string }>;

/**
 * Crawls all active FORUM sources and persists extracted Business Class
 * deal candidates. One source failing (blocked, changed format, ...) never
 * aborts the others.
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
      results[source.name] = await crawlRssFeed(source, airlines, airports);
    } catch (error) {
      results[source.name] = { error: (error as Error).message };
    }
  }

  return results;
}
