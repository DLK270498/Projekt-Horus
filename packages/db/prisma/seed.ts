import { PrismaClient, type HaulType } from "../generated/client/index.js";

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

async function main() {
  console.log(`Seeding ${airlines.length} airlines...`);

  for (const airline of airlines) {
    await prisma.airline.upsert({
      where: { iataCode: airline.iataCode },
      update: airline,
      create: airline,
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
