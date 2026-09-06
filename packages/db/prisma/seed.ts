import { PrismaClient, type HaulType, type SourceType } from "../generated/client/index.js";

const prisma = new PrismaClient();

/**
 * Airline longlist: carriers offering Business Class ex-Germany.
 * skytraxRating is researched once and kept as a static field (see project plan) -
 * revisit periodically, these are approximate public Skytrax star ratings.
 */
const airlines: Array<{
  iataCode: string;
  name: string;
  homeCountry: string;
  skytraxRating: number;
  haulTypes: HaulType[];
}> = [
  // Long-haul premium (4-5 star)
  { iataCode: "LH", name: "Lufthansa", homeCountry: "Germany", skytraxRating: 5, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "QR", name: "Qatar Airways", homeCountry: "Qatar", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "SQ", name: "Singapore Airlines", homeCountry: "Singapore", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "NH", name: "All Nippon Airways", homeCountry: "Japan", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "CX", name: "Cathay Pacific", homeCountry: "Hong Kong", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "OZ", name: "Asiana Airlines", homeCountry: "South Korea", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "BR", name: "EVA Air", homeCountry: "Taiwan", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "MH", name: "Malaysia Airlines", homeCountry: "Malaysia", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "JL", name: "Japan Airlines", homeCountry: "Japan", skytraxRating: 5, haulTypes: ["LONG"] },
  { iataCode: "EK", name: "Emirates", homeCountry: "UAE", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "EY", name: "Etihad Airways", homeCountry: "UAE", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "TK", name: "Turkish Airlines", homeCountry: "Turkey", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },

  // Long-haul standard (3-4 star)
  { iataCode: "LX", name: "Swiss International Air Lines", homeCountry: "Switzerland", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "OS", name: "Austrian Airlines", homeCountry: "Austria", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "AF", name: "Air France", homeCountry: "France", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "KL", name: "KLM Royal Dutch Airlines", homeCountry: "Netherlands", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "BA", name: "British Airways", homeCountry: "United Kingdom", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "VS", name: "Virgin Atlantic", homeCountry: "United Kingdom", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "UA", name: "United Airlines", homeCountry: "USA", skytraxRating: 3, haulTypes: ["LONG"] },
  { iataCode: "DL", name: "Delta Air Lines", homeCountry: "USA", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "AA", name: "American Airlines", homeCountry: "USA", skytraxRating: 3, haulTypes: ["LONG"] },
  { iataCode: "AC", name: "Air Canada", homeCountry: "Canada", skytraxRating: 3, haulTypes: ["LONG"] },
  { iataCode: "AY", name: "Finnair", homeCountry: "Finland", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "LO", name: "LOT Polish Airlines", homeCountry: "Poland", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "SK", name: "SAS Scandinavian Airlines", homeCountry: "Sweden", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "IB", name: "Iberia", homeCountry: "Spain", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "TP", name: "TAP Air Portugal", homeCountry: "Portugal", skytraxRating: 3, haulTypes: ["LONG", "MID", "SHORT"] },
  { iataCode: "TG", name: "Thai Airways", homeCountry: "Thailand", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "VN", name: "Vietnam Airlines", homeCountry: "Vietnam", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "CZ", name: "China Southern Airlines", homeCountry: "China", skytraxRating: 4, haulTypes: ["LONG"] },
  { iataCode: "MU", name: "China Eastern Airlines", homeCountry: "China", skytraxRating: 4, haulTypes: ["LONG"] },

  // Mid/short-haul ex-Germany (Business often premium-economy grade)
  { iataCode: "EW", name: "Eurowings", homeCountry: "Germany", skytraxRating: 3, haulTypes: ["SHORT", "MID"] },
  { iataCode: "DE", name: "Condor", homeCountry: "Germany", skytraxRating: 3, haulTypes: ["LONG", "MID"] },
];

/**
 * Airports: German origin hubs + a first batch of common long-haul
 * destinations, enough to test ingestion end-to-end. Extend as new
 * routes get scraped.
 */
const airports: Array<{
  iataCode: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}> = [
  { iataCode: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany", latitude: 50.0379, longitude: 8.5622 },
  { iataCode: "MUC", name: "Munich Airport", city: "Munich", country: "Germany", latitude: 48.3538, longitude: 11.7861 },
  { iataCode: "DUS", name: "Düsseldorf Airport", city: "Düsseldorf", country: "Germany", latitude: 51.2895, longitude: 6.7668 },
  { iataCode: "BER", name: "Berlin Brandenburg Airport", city: "Berlin", country: "Germany", latitude: 52.3667, longitude: 13.5033 },
  { iataCode: "HAM", name: "Hamburg Airport", city: "Hamburg", country: "Germany", latitude: 53.6304, longitude: 9.9882 },
  { iataCode: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "USA", latitude: 40.6413, longitude: -73.7781 },
  { iataCode: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", latitude: 1.3644, longitude: 103.9915 },
  { iataCode: "DXB", name: "Dubai International Airport", city: "Dubai", country: "UAE", latitude: 25.2532, longitude: 55.3657 },
  { iataCode: "HND", name: "Tokyo Haneda Airport", city: "Tokyo", country: "Japan", latitude: 35.5494, longitude: 139.7798 },
  { iataCode: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand", latitude: 13.6900, longitude: 100.7501 },
  { iataCode: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia", latitude: -33.9399, longitude: 151.1753 },
  { iataCode: "JNB", name: "OR Tambo International Airport", city: "Johannesburg", country: "South Africa", latitude: -26.1392, longitude: 28.2460 },
  { iataCode: "GRU", name: "São Paulo–Guarulhos International Airport", city: "São Paulo", country: "Brazil", latitude: -23.4356, longitude: -46.4731 },
  { iataCode: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "USA", latitude: 33.9416, longitude: -118.4085 },
  { iataCode: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong", latitude: 22.3080, longitude: 113.9185 },
];

/**
 * Ingestion sources. google_flights is a SCRAPER (Playwright), the rest are
 * FORUM/deal-blog feeds crawled via RSS/JSON. See apps/worker.
 */
const sources: Array<{
  name: string;
  type: SourceType;
  baseUrl: string;
}> = [
  { name: "google_flights", type: "SCRAPER", baseUrl: "https://www.google.com/travel/flights" },
  { name: "secret_flying", type: "FORUM", baseUrl: "https://www.secretflying.com/feed/" },
  { name: "mighty_travels", type: "FORUM", baseUrl: "https://www.mightytravels.com/feed/" },
  { name: "loyalty_lobby", type: "FORUM", baseUrl: "https://loyaltylobby.com/feed/" },
  { name: "reddit_awardtravel", type: "FORUM", baseUrl: "https://www.reddit.com/r/awardtravel/new.json?limit=25" },
];

async function main() {
  console.log(`Seeding ${airlines.length} airlines...`);
  for (const airline of airlines) {
    await prisma.airline.upsert({
      where: { iataCode: airline.iataCode },
      update: airline,
      create: airline,
    });
  }

  console.log(`Seeding ${airports.length} airports...`);
  for (const airport of airports) {
    await prisma.airport.upsert({
      where: { iataCode: airport.iataCode },
      update: airport,
      create: airport,
    });
  }

  console.log(`Seeding ${sources.length} sources...`);
  for (const source of sources) {
    await prisma.source.upsert({
      where: { name: source.name },
      update: source,
      create: source,
    });
  }

  console.log("Seeding done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
