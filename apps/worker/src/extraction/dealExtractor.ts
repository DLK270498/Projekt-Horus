/**
 * Best-effort text extraction for forum/deal-blog posts. Deliberately
 * conservative: returns null unless we can confidently pin down a price
 * and two known airports (by IATA code OR city name — real deal posts
 * mostly use city names, e.g. "Business Class Deal: Brussels to Hong
 * Kong 1720€"), so we don't pollute price_observations with noise.
 *
 * Scoped to our product (ex-Germany deals): if neither matched airport is
 * in Germany, the post is dropped, UNLESS the text just says "Germany"
 * generically (common in curated deal titles, e.g. "Germany to the USA
 * 1250€") — that generic mention is resolved to Frankfurt as the default
 * hub rather than discarding an otherwise-perfectly-good deal.
 */

export type KnownAirline = { id: string; iataCode: string; name: string };
export type KnownAirport = { id: string; iataCode: string; city: string; country: string };

export type ExtractedDeal = {
  price: number;
  currency: "EUR" | "USD" | "GBP";
  originAirportId: string;
  destinationAirportId: string;
  airlineId: string | null;
};

// Symbol-before-amount ("€1.199", "$1,450") and amount-before-symbol
// ("1720€" — the common format in curated deal posts) both occur in the
// wild, so match either order.
const AMOUNT = "\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?";
const CURRENCY_SYMBOL = "€|EUR|\\$|USD|£|GBP";
const PRICE_PATTERN = new RegExp(
  `(?:(${CURRENCY_SYMBOL})\\s?(${AMOUNT}))|(?:(${AMOUNT})\\s?(${CURRENCY_SYMBOL}))`,
  "i",
);
const CURRENCY_BY_SYMBOL: Record<string, ExtractedDeal["currency"]> = {
  "€": "EUR",
  eur: "EUR",
  "$": "USD",
  usd: "USD",
  "£": "GBP",
  gbp: "GBP",
};

// EUR prices in the wild are written the European way (dot = thousands,
// comma = decimal, e.g. "1.199,50"); USD/GBP the US way (comma = thousands,
// dot = decimal, e.g. "1,199.50"). Normalizing by currency avoids
// misreading "$1,450.00" as 1.45.
function normalizeAmount(raw: string, currency: ExtractedDeal["currency"]): string {
  if (currency === "EUR") {
    return raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/\./g, "");
  }
  return raw.replace(/,/g, "");
}

function parsePrice(text: string): { price: number; currency: ExtractedDeal["currency"] } | null {
  const match = text.match(PRICE_PATTERN);
  if (!match) return null;

  const symbol = match[1] ?? match[4];
  const amount = match[2] ?? match[3];
  const currency = CURRENCY_BY_SYMBOL[symbol.toLowerCase()];
  if (!currency) return null;

  const price = Number.parseFloat(normalizeAmount(amount, currency));
  if (!Number.isFinite(price) || price < 50 || price > 50_000) return null;

  return { price, currency };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type AirportMatch = { airport: KnownAirport; index: number };

function findAirports(text: string, knownAirports: KnownAirport[]): KnownAirport[] {
  const matches: AirportMatch[] = [];

  for (const airport of knownAirports) {
    const codeMatch = text.match(new RegExp(`\\b${airport.iataCode}\\b`));
    if (codeMatch?.index !== undefined) {
      matches.push({ airport, index: codeMatch.index });
      continue;
    }

    const cityMatch = text.match(new RegExp(`\\b${escapeRegex(airport.city)}\\b`, "i"));
    if (cityMatch?.index !== undefined) {
      matches.push({ airport, index: cityMatch.index });
    }
  }

  const hasGermanMatch = matches.some((m) => m.airport.country === "Germany");
  if (matches.length < 2 && !hasGermanMatch) {
    const genericGermanyMatch = text.match(/\bgermany\b/i);
    const frankfurt = knownAirports.find((a) => a.iataCode === "FRA");
    if (genericGermanyMatch?.index !== undefined && frankfurt) {
      matches.push({ airport: frankfurt, index: genericGermanyMatch.index });
    }
  }

  const sorted = matches.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const ordered: KnownAirport[] = [];
  for (const match of sorted) {
    if (seen.has(match.airport.id)) continue;
    seen.add(match.airport.id);
    ordered.push(match.airport);
  }

  return ordered;
}

function findAirline(text: string, knownAirlines: KnownAirline[]): KnownAirline | null {
  const lower = text.toLowerCase();
  for (const airline of knownAirlines) {
    if (lower.includes(airline.name.toLowerCase())) {
      return airline;
    }
  }
  return null;
}

export function extractDeal(
  text: string,
  knownAirlines: KnownAirline[],
  knownAirports: KnownAirport[],
): ExtractedDeal | null {
  if (!/business\s*class/i.test(text)) return null;

  const priceMatch = parsePrice(text);
  if (!priceMatch) return null;

  const airports = findAirports(text, knownAirports);
  if (airports.length < 2) return null;

  const [originAirport, destinationAirport] = airports;
  if (originAirport.country !== "Germany" && destinationAirport.country !== "Germany") {
    return null; // out of scope: this product only tracks ex-Germany deals
  }

  const airline = findAirline(text, knownAirlines);

  return {
    price: priceMatch.price,
    currency: priceMatch.currency,
    originAirportId: originAirport.id,
    destinationAirportId: destinationAirport.id,
    airlineId: airline?.id ?? null,
  };
}
