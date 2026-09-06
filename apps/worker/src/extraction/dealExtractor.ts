/**
 * Best-effort text extraction for forum/deal-blog posts. Deliberately
 * conservative: returns null unless we can confidently pin down a price
 * and at least one known airport, so we don't pollute price_observations
 * with noise. Route/airline detection is heuristic (see plan risks) and
 * expected to improve once we have real post samples to tune against.
 */

export type KnownAirline = { id: string; iataCode: string; name: string };
export type KnownAirport = { id: string; iataCode: string };

export type ExtractedDeal = {
  price: number;
  currency: "EUR" | "USD" | "GBP";
  originAirportId: string;
  destinationAirportId: string;
  airlineId: string | null;
};

const PRICE_PATTERN = /(€|EUR|\$|USD|£|GBP)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i;
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

  const currency = CURRENCY_BY_SYMBOL[match[1].toLowerCase()];
  if (!currency) return null;

  const price = Number.parseFloat(normalizeAmount(match[2], currency));
  if (!Number.isFinite(price) || price < 50 || price > 50_000) return null;

  return { price, currency };
}

function findAirportCodes(text: string, knownAirports: KnownAirport[]): string[] {
  const knownCodes = new Set(knownAirports.map((a) => a.iataCode));
  const candidates = text.match(/\b[A-Z]{3}\b/g) ?? [];
  const found: string[] = [];
  for (const code of candidates) {
    if (knownCodes.has(code) && !found.includes(code)) {
      found.push(code);
    }
    if (found.length === 2) break;
  }
  return found;
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

  const codes = findAirportCodes(text, knownAirports);
  if (codes.length < 2) return null;

  const originAirport = knownAirports.find((a) => a.iataCode === codes[0]);
  const destinationAirport = knownAirports.find((a) => a.iataCode === codes[1]);
  if (!originAirport || !destinationAirport) return null;

  const airline = findAirline(text, knownAirlines);

  return {
    price: priceMatch.price,
    currency: priceMatch.currency,
    originAirportId: originAirport.id,
    destinationAirportId: destinationAirport.id,
    airlineId: airline?.id ?? null,
  };
}
