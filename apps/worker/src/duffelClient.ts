import { prisma } from "./prisma.js";

const DUFFEL_API_BASE = "https://api.duffel.com";
const DUFFEL_API_VERSION = "v2";
const REQUEST_TIMEOUT_MS = 30_000;

type DuffelOffer = {
  total_amount: string;
  total_currency: string;
  owner: { iata_code: string; name: string };
  slices: Array<{
    segments: Array<{ departing_at: string }>;
  }>;
};

type DuffelOfferRequestResponse = {
  data?: { offers?: DuffelOffer[] };
  errors?: Array<{ title: string; message: string }>;
};

export type FlightQuery = {
  originIata: string;
  destinationIata: string;
  departureDate: string; // YYYY-MM-DD
};

export type CheapestOfferByAirline = {
  airlineIataCode: string;
  price: number;
  currency: string;
  departureDate: string;
};

/**
 * Queries Duffel for Business Class offers on one route/date and returns
 * the cheapest offer per marketing airline. Duffel's sandbox ("test") token
 * returns realistic but synthetic offers - same shape as production, so
 * this same code works unchanged once a live token is used.
 */
export async function fetchCheapestOffersByAirline(
  query: FlightQuery,
  accessToken: string,
): Promise<CheapestOfferByAirline[]> {
  const response = await fetch(`${DUFFEL_API_BASE}/air/offer_requests?return_offers=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Duffel-Version": DUFFEL_API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices: [{ origin: query.originIata, destination: query.destinationIata, departure_date: query.departureDate }],
        passengers: [{ type: "adult" }],
        cabin_class: "business",
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = (await response.json()) as DuffelOfferRequestResponse;

  if (!response.ok) {
    const message = payload.errors?.map((e) => e.message).join("; ") ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  const offers = payload.data?.offers ?? [];
  const cheapestByAirline = new Map<string, CheapestOfferByAirline>();

  for (const offer of offers) {
    const price = Number.parseFloat(offer.total_amount);
    if (!Number.isFinite(price)) continue;

    const existing = cheapestByAirline.get(offer.owner.iata_code);
    if (existing && existing.price <= price) continue;

    cheapestByAirline.set(offer.owner.iata_code, {
      airlineIataCode: offer.owner.iata_code,
      price,
      currency: offer.total_currency,
      departureDate: offer.slices[0]?.segments[0]?.departing_at?.slice(0, 10) ?? query.departureDate,
    });
  }

  return [...cheapestByAirline.values()];
}

/**
 * Runs fetchCheapestOffersByAirline for a route across several departure
 * dates so the baseline engine (apps/worker/src/baseline.ts) has more than
 * one data point per (airline, route, cabin) to compare against - a single
 * snapshot can never be identified as "cheaper than usual".
 */
export async function ingestDuffelRoute(
  query: { originIata: string; destinationIata: string; departureDates: string[] },
  accessToken: string,
): Promise<{ observationsCreated: number; errors: string[] }> {
  const [origin, destination, source, airlines] = await Promise.all([
    prisma.airport.findUnique({ where: { iataCode: query.originIata } }),
    prisma.airport.findUnique({ where: { iataCode: query.destinationIata } }),
    prisma.source.findUniqueOrThrow({ where: { name: "duffel" } }),
    prisma.airline.findMany({ where: { isActive: true }, select: { id: true, iataCode: true } }),
  ]);

  if (!origin || !destination) {
    return { observationsCreated: 0, errors: [`Unknown airport: ${query.originIata} or ${query.destinationIata}`] };
  }

  const airlineIdByCode = new Map(airlines.map((a) => [a.iataCode, a.id]));
  let observationsCreated = 0;
  const errors: string[] = [];

  for (const departureDate of query.departureDates) {
    try {
      const offers = await fetchCheapestOffersByAirline(
        { originIata: query.originIata, destinationIata: query.destinationIata, departureDate },
        accessToken,
      );

      for (const offer of offers) {
        const airlineId = airlineIdByCode.get(offer.airlineIataCode);
        if (!airlineId) continue; // not on our tracked longlist

        await prisma.priceObservation.create({
          data: {
            airlineId,
            originAirportId: origin.id,
            destinationAirportId: destination.id,
            sourceId: source.id,
            cabinClass: "BUSINESS",
            departureDate: new Date(offer.departureDate),
            price: offer.price,
            currency: offer.currency,
          },
        });
        observationsCreated++;
      }
    } catch (error) {
      errors.push(`${query.originIata}->${query.destinationIata} on ${departureDate}: ${(error as Error).message}`);
    }
  }

  return { observationsCreated, errors };
}
