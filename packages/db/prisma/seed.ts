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
  websiteUrl: string;
}> = [
  // Long-haul premium (4-5 star)
  { iataCode: "LH", name: "Lufthansa", homeCountry: "Germany", skytraxRating: 5, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.lufthansa.com" },
  { iataCode: "QR", name: "Qatar Airways", homeCountry: "Qatar", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.qatarairways.com" },
  { iataCode: "SQ", name: "Singapore Airlines", homeCountry: "Singapore", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.singaporeair.com" },
  { iataCode: "NH", name: "All Nippon Airways", homeCountry: "Japan", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.ana.co.jp" },
  { iataCode: "CX", name: "Cathay Pacific", homeCountry: "Hong Kong", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.cathaypacific.com" },
  { iataCode: "OZ", name: "Asiana Airlines", homeCountry: "South Korea", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://flyasiana.com" },
  { iataCode: "BR", name: "EVA Air", homeCountry: "Taiwan", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.evaair.com" },
  { iataCode: "MH", name: "Malaysia Airlines", homeCountry: "Malaysia", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.malaysiaairlines.com" },
  { iataCode: "JL", name: "Japan Airlines", homeCountry: "Japan", skytraxRating: 5, haulTypes: ["LONG"], websiteUrl: "https://www.jal.com" },
  { iataCode: "EK", name: "Emirates", homeCountry: "UAE", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.emirates.com" },
  { iataCode: "EY", name: "Etihad Airways", homeCountry: "UAE", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.etihad.com" },
  { iataCode: "TK", name: "Turkish Airlines", homeCountry: "Turkey", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.turkishairlines.com" },

  // Long-haul standard (3-4 star)
  { iataCode: "LX", name: "Swiss International Air Lines", homeCountry: "Switzerland", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.swiss.com" },
  { iataCode: "OS", name: "Austrian Airlines", homeCountry: "Austria", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.austrian.com" },
  { iataCode: "AF", name: "Air France", homeCountry: "France", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.airfrance.com" },
  { iataCode: "KL", name: "KLM Royal Dutch Airlines", homeCountry: "Netherlands", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.klm.com" },
  { iataCode: "BA", name: "British Airways", homeCountry: "United Kingdom", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.britishairways.com" },
  { iataCode: "VS", name: "Virgin Atlantic", homeCountry: "United Kingdom", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.virginatlantic.com" },
  { iataCode: "UA", name: "United Airlines", homeCountry: "USA", skytraxRating: 3, haulTypes: ["LONG"], websiteUrl: "https://www.united.com" },
  { iataCode: "DL", name: "Delta Air Lines", homeCountry: "USA", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.delta.com" },
  { iataCode: "AA", name: "American Airlines", homeCountry: "USA", skytraxRating: 3, haulTypes: ["LONG"], websiteUrl: "https://www.aa.com" },
  { iataCode: "AC", name: "Air Canada", homeCountry: "Canada", skytraxRating: 3, haulTypes: ["LONG"], websiteUrl: "https://www.aircanada.com" },
  { iataCode: "AY", name: "Finnair", homeCountry: "Finland", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.finnair.com" },
  { iataCode: "LO", name: "LOT Polish Airlines", homeCountry: "Poland", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.lot.com" },
  { iataCode: "SK", name: "SAS Scandinavian Airlines", homeCountry: "Sweden", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.flysas.com" },
  { iataCode: "IB", name: "Iberia", homeCountry: "Spain", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.iberia.com" },
  { iataCode: "TP", name: "TAP Air Portugal", homeCountry: "Portugal", skytraxRating: 3, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.flytap.com" },
  { iataCode: "TG", name: "Thai Airways", homeCountry: "Thailand", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.thaiairways.com" },
  { iataCode: "VN", name: "Vietnam Airlines", homeCountry: "Vietnam", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.vietnamairlines.com" },
  { iataCode: "CZ", name: "China Southern Airlines", homeCountry: "China", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.csair.com" },
  { iataCode: "MU", name: "China Eastern Airlines", homeCountry: "China", skytraxRating: 4, haulTypes: ["LONG"], websiteUrl: "https://www.ceair.com" },

  // Mid/short-haul ex-Germany (Business often premium-economy grade)
  { iataCode: "EW", name: "Eurowings", homeCountry: "Germany", skytraxRating: 3, haulTypes: ["SHORT", "MID"], websiteUrl: "https://www.eurowings.com" },
  { iataCode: "DE", name: "Condor", homeCountry: "Germany", skytraxRating: 3, haulTypes: ["LONG", "MID"], websiteUrl: "https://www.condor.com" },
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

  // Added after the first real forum-crawl run (r/flightdeals) surfaced
  // these as common destinations in curated Business Class deal posts.
  { iataCode: "VIE", name: "Vienna International Airport", city: "Vienna", country: "Austria", latitude: 48.1103, longitude: 16.5697 },
  { iataCode: "ZRH", name: "Zurich Airport", city: "Zurich", country: "Switzerland", latitude: 47.4647, longitude: 8.5492 },
  { iataCode: "BRU", name: "Brussels Airport", city: "Brussels", country: "Belgium", latitude: 50.9014, longitude: 4.4844 },
  { iataCode: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", country: "Sweden", latitude: 59.6519, longitude: 17.9186 },
  { iataCode: "CPH", name: "Copenhagen Airport", city: "Copenhagen", country: "Denmark", latitude: 55.6180, longitude: 12.6560 },
  { iataCode: "OSL", name: "Oslo Airport", city: "Oslo", country: "Norway", latitude: 60.1976, longitude: 11.1004 },
  { iataCode: "HEL", name: "Helsinki-Vantaa Airport", city: "Helsinki", country: "Finland", latitude: 60.3172, longitude: 24.9633 },
  { iataCode: "MAD", name: "Adolfo Suárez Madrid–Barajas Airport", city: "Madrid", country: "Spain", latitude: 40.4936, longitude: -3.5668 },
  { iataCode: "FCO", name: "Rome Fiumicino Airport", city: "Rome", country: "Italy", latitude: 41.8003, longitude: 12.2389 },
  { iataCode: "DUB", name: "Dublin Airport", city: "Dublin", country: "Ireland", latitude: 53.4213, longitude: -6.2701 },
  { iataCode: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands", latitude: 52.3105, longitude: 4.7683 },
  { iataCode: "LHR", name: "London Heathrow Airport", city: "London", country: "United Kingdom", latitude: 51.4700, longitude: -0.4543 },
  { iataCode: "ZAG", name: "Zagreb Airport", city: "Zagreb", country: "Croatia", latitude: 45.7429, longitude: 16.0688 },
  { iataCode: "ICN", name: "Incheon International Airport", city: "Seoul", country: "South Korea", latitude: 37.4602, longitude: 126.4407 },
  { iataCode: "PEK", name: "Beijing Capital International Airport", city: "Beijing", country: "China", latitude: 40.0799, longitude: 116.6031 },
  { iataCode: "PVG", name: "Shanghai Pudong International Airport", city: "Shanghai", country: "China", latitude: 31.1443, longitude: 121.8083 },
  { iataCode: "CPT", name: "Cape Town International Airport", city: "Cape Town", country: "South Africa", latitude: -33.9715, longitude: 18.6021 },
  { iataCode: "CUN", name: "Cancún International Airport", city: "Cancun", country: "Mexico", latitude: 21.0365, longitude: -86.8771 },
  { iataCode: "PUJ", name: "Punta Cana International Airport", city: "Punta Cana", country: "Dominican Republic", latitude: 18.5674, longitude: -68.3634 },
  { iataCode: "ATH", name: "Athens International Airport", city: "Athens", country: "Greece", latitude: 37.9364, longitude: 23.9445 },
  { iataCode: "BOS", name: "Boston Logan International Airport", city: "Boston", country: "USA", latitude: 42.3656, longitude: -71.0096 },
  { iataCode: "ORD", name: "Chicago O'Hare International Airport", city: "Chicago", country: "USA", latitude: 41.9742, longitude: -87.9073 },
  { iataCode: "YYZ", name: "Toronto Pearson International Airport", city: "Toronto", country: "Canada", latitude: 43.6777, longitude: -79.6248 },
  { iataCode: "LIS", name: "Lisbon Airport", city: "Lisbon", country: "Portugal", latitude: 38.7813, longitude: -9.1359 },

  // Added for the Munich-focused, research-informed route selection: new
  // (Sao Paulo, Johannesburg) or upgauged (Mumbai, Seattle) Lufthansa
  // Munich long-haul routes tend to carry launch/promotional fares while
  // filling capacity - see apps/worker/src/index.ts for the reasoning.
  { iataCode: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", country: "India", latitude: 19.0896, longitude: 72.8656 },
  { iataCode: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", country: "India", latitude: 28.5562, longitude: 77.1000 },
  { iataCode: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle", country: "USA", latitude: 47.4502, longitude: -122.3088 },
];

/**
 * Ingestion sources. google_flights is a SCRAPER (Playwright), the rest are
 * FORUM/deal-blog feeds crawled via RSS/Atom. See apps/worker.
 *
 * reddit_awardtravel is deactivated: it's a discussion sub about award/points
 * bookings, not cash fare deals, so our price-based extraction never matched
 * anything there. r/flightdeals actually posts curated cash-price deals in
 * exactly the format we need ("Business Class Deal: City to City, Price"),
 * and its .rss endpoint isn't blocked the way the .json API was.
 */
const sources: Array<{
  name: string;
  type: SourceType;
  baseUrl: string;
  isActive: boolean;
}> = [
  { name: "google_flights", type: "SCRAPER", baseUrl: "https://www.google.com/travel/flights", isActive: true },
  { name: "secret_flying", type: "FORUM", baseUrl: "https://www.secretflying.com/feed/", isActive: true },
  { name: "mighty_travels", type: "FORUM", baseUrl: "https://www.mightytravels.com/feed/", isActive: true },
  { name: "loyalty_lobby", type: "FORUM", baseUrl: "https://loyaltylobby.com/feed/", isActive: true },
  { name: "reddit_awardtravel", type: "FORUM", baseUrl: "https://www.reddit.com/r/awardtravel/new.json?limit=25", isActive: false },
  { name: "reddit_flightdeals", type: "FORUM", baseUrl: "https://www.reddit.com/r/flightdeals/.rss?limit=100", isActive: true },
  { name: "duffel", type: "SCRAPER", baseUrl: "https://api.duffel.com", isActive: true },
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
