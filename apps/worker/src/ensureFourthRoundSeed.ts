import { prisma } from "./prisma.js";
import type { HaulType } from "@horus/db";

// packages/db/prisma/seed.ts is the source of truth for the full airline/
// airport longlist, but it only runs when someone (or Railway's deploy
// pipeline) explicitly triggers it - this worker has no reliable way to
// confirm that happened before it starts querying Duffel for routes/
// carriers that don't exist in the DB yet. ingestDuffelRoute looks airports
// up by iataCode and silently drops any offer from an airline not already
// seeded, so missing rows here wouldn't error - they'd just quietly throw
// away the exact deals this round exists to find. Upserting the small set
// of NEW rows this round depends on (kept in sync with seed.ts) makes the
// worker self-sufficient regardless of deploy-pipeline configuration. Keep
// this in sync with packages/db/prisma/seed.ts's "value hub" carrier and
// destination additions - see apps/worker/src/index.ts for why they exist.
const NEW_AIRLINES: Array<{ iataCode: string; name: string; homeCountry: string; skytraxRating: number; haulTypes: HaulType[]; websiteUrl: string }> = [
  { iataCode: "ET", name: "Ethiopian Airlines", homeCountry: "Ethiopia", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.ethiopianairlines.com" },
  { iataCode: "KQ", name: "Kenya Airways", homeCountry: "Kenya", skytraxRating: 3, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.kenya-airways.com" },
  { iataCode: "MS", name: "EgyptAir", homeCountry: "Egypt", skytraxRating: 3, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.egyptair.com" },
  { iataCode: "AI", name: "Air India", homeCountry: "India", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.airindia.com" },
  { iataCode: "AT", name: "Royal Air Maroc", homeCountry: "Morocco", skytraxRating: 3, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.royalairmaroc.com" },
  { iataCode: "RJ", name: "Royal Jordanian", homeCountry: "Jordan", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.rj.com" },
  { iataCode: "SV", name: "Saudia", homeCountry: "Saudi Arabia", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.saudia.com" },
  { iataCode: "GF", name: "Gulf Air", homeCountry: "Bahrain", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.gulfair.com" },
  { iataCode: "WY", name: "Oman Air", homeCountry: "Oman", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.omanair.com" },
  { iataCode: "WB", name: "RwandAir", homeCountry: "Rwanda", skytraxRating: 3, haulTypes: ["MID", "SHORT"], websiteUrl: "https://www.rwandair.com" },
  { iataCode: "AV", name: "Avianca", homeCountry: "Colombia", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.avianca.com" },
  { iataCode: "LA", name: "LATAM Airlines", homeCountry: "Chile", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.latamairlines.com" },
  { iataCode: "GA", name: "Garuda Indonesia", homeCountry: "Indonesia", skytraxRating: 4, haulTypes: ["LONG", "MID", "SHORT"], websiteUrl: "https://www.garuda-indonesia.com" },
];

const NEW_AIRPORTS: Array<{ iataCode: string; name: string; city: string; country: string; latitude: number; longitude: number }> = [
  { iataCode: "SEZ", name: "Seychelles International Airport", city: "Victoria", country: "Seychelles", latitude: -4.6743, longitude: 55.5218 },
  { iataCode: "ZNZ", name: "Abeid Amani Karume International Airport", city: "Zanzibar City", country: "Tanzania", latitude: -6.2220, longitude: 39.2249 },
  { iataCode: "KGL", name: "Kigali International Airport", city: "Kigali", country: "Rwanda", latitude: -1.9686, longitude: 30.1395 },
  { iataCode: "GIG", name: "Rio de Janeiro–Galeão International Airport", city: "Rio de Janeiro", country: "Brazil", latitude: -22.8090, longitude: -43.2506 },
  { iataCode: "SSA", name: "Salvador International Airport", city: "Salvador", country: "Brazil", latitude: -12.9086, longitude: -38.3225 },
  { iataCode: "BOG", name: "El Dorado International Airport", city: "Bogotá", country: "Colombia", latitude: 4.7016, longitude: -74.1469 },
  { iataCode: "CGK", name: "Soekarno-Hatta International Airport", city: "Jakarta", country: "Indonesia", latitude: -6.1256, longitude: 106.6559 },
  { iataCode: "DPS", name: "Ngurah Rai International Airport", city: "Denpasar (Bali)", country: "Indonesia", latitude: -8.7482, longitude: 115.1671 },
];

export async function ensureFourthRoundSeed(): Promise<void> {
  for (const airline of NEW_AIRLINES) {
    await prisma.airline.upsert({ where: { iataCode: airline.iataCode }, update: airline, create: airline });
  }
  for (const airport of NEW_AIRPORTS) {
    await prisma.airport.upsert({ where: { iataCode: airport.iataCode }, update: airport, create: airport });
  }
  console.log(`Ensured ${NEW_AIRLINES.length} new airline(s) and ${NEW_AIRPORTS.length} new airport(s) exist.`);
}
