// Google Flights' natural-language search box (?q=...) has no reliable way
// to carry route + both dates + cabin class at once - every combination
// that included a cabin-class phrase alongside a round-trip date range
// made the parser drop everything but the origin (confirmed repeatedly
// while prototyping this in the click-dummy artifact). Google Flights
// itself doesn't use that text box internally though - it encodes the
// whole search (legs, dates, cabin, airline, trip type) as a protobuf
// message in the "tfs" URL parameter. That structure was reverse-engineered
// by the community; this encoder was validated by round-tripping a real
// captured tfs value (JFK<->SFO 2026-01-12/29, economy) and matching its
// bytes exactly before being adapted for our own business-class searches.

function tfsVarint(value: number | bigint): number[] {
  const bytes: number[] = [];
  let v = BigInt(value);
  if (v < 0n) v &= 0xffffffffffffffffn;
  while (v > 0x7fn) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return bytes;
}

const tfsTag = (field: number, wireType: number) => tfsVarint((field << 3) | wireType);

function tfsStringField(field: number, str: string): number[] {
  const strBytes = Array.from(Buffer.from(str, "utf-8"));
  return [...tfsTag(field, 2), ...tfsVarint(strBytes.length), ...strBytes];
}

const tfsVarintField = (field: number, value: number) => [...tfsTag(field, 0), ...tfsVarint(value)];
const tfsMessageField = (field: number, bytes: number[]) => [...tfsTag(field, 2), ...tfsVarint(bytes.length), ...bytes];
const tfsPlace = (iata: string) => [...tfsVarintField(1, 1), ...tfsStringField(2, iata)];

function tfsLeg(origin: string, destination: string, date: string, airlineIata?: string): number[] {
  return [
    ...tfsStringField(2, date),
    ...(airlineIata ? tfsStringField(6, airlineIata) : []),
    ...tfsMessageField(13, tfsPlace(origin)),
    ...tfsMessageField(14, tfsPlace(destination)),
  ];
}

// Field 16 ("show all results") as observed in every captured example -
// a nested message containing field 1 = -1 encoded as a 10-byte varint.
const TFS_ALL_RESULTS_FLAG = [0x82, 0x01, 0x0b, 0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01];
const CABIN_BUSINESS = 3;

type GoogleFlightsQuery = {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null; // YYYY-MM-DD, omit for one-way
  airlineIata?: string;
};

function encodeTfs(q: GoogleFlightsQuery): number[] {
  const bytes: number[] = [];
  bytes.push(...tfsVarintField(1, 28)); // constant in every captured example
  bytes.push(...tfsVarintField(2, 2)); // constant in every captured example
  bytes.push(...tfsMessageField(3, tfsLeg(q.origin, q.destination, q.departureDate, q.airlineIata)));
  if (q.returnDate) {
    bytes.push(...tfsMessageField(3, tfsLeg(q.destination, q.origin, q.returnDate, q.airlineIata)));
  }
  bytes.push(...tfsVarintField(8, 1)); // 1 adult
  bytes.push(...tfsVarintField(9, CABIN_BUSINESS));
  bytes.push(...tfsVarintField(14, 1)); // display_flag constant
  bytes.push(...TFS_ALL_RESULTS_FLAG);
  bytes.push(...tfsVarintField(19, q.returnDate ? 1 : 2)); // trip_type: round trip / one way
  return bytes;
}

function base64UrlEncode(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function googleFlightsUrl(query: GoogleFlightsQuery): string {
  const tfs = base64UrlEncode(encodeTfs(query));
  return `https://www.google.com/travel/flights/search?tfs=${tfs}`;
}
