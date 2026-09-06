import { prisma } from "./prisma.js";
import { assertBudgetAvailable, recordRequest, hardCapEur, DuffelBudgetExceededError } from "./duffelBudget.js";

// IMPORTANT: PriceObservation has no test/live flag, and baseline.ts's
// median calculation doesn't distinguish sources - mixing a test-token run
// with a live-token run in the same DB silently corrupts every baseline
// that spans both (already happened once; fixed by deleting the test-mode
// rows and recomputing deals from scratch). Never run this against a
// duffel_test_ token against a database that also holds duffel_live_ data,
// or vice versa, without clearing the other environment's rows first.
const DUFFEL_API_BASE = "https://api.duffel.com";
const DUFFEL_API_VERSION = "v2";
const REQUEST_TIMEOUT_MS = 30_000;

// Duffel rate-limits rapid sequential requests (hit this for real: several
// requests in a row started failing with "Too many requests hit the API too
// quickly"). A fixed gap between requests plus one retry with backoff on
// 429 keeps a multi-route, multi-date run from losing data to throttling.
const DELAY_BETWEEN_REQUESTS_MS = 700;
const RATE_LIMIT_RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { iata_code: string; name: string };
  slices: Array<{
    fare_brand_name?: string;
    segments: Array<{
      departing_at: string;
      arriving_at: string;
      aircraft?: { name: string } | null;
      operating_carrier?: { iata_code: string } | null;
    }>;
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
  returnDate: string; // YYYY-MM-DD - round-trip only; one-way business fares are
  // disproportionately expensive (often 60-80% of the round-trip price, not
  // 50%) and aren't what "a deal" means in this market - see project notes
  // for the real-world price mismatch this caused when we queried one-way.
};

export type CheapestOfferByAirline = {
  airlineIataCode: string;
  price: number;
  currency: string;
  departureDate: string;
  returnDate: string;
  raw: {
    offerId: string;
    fareBrandName: string | null;
    stops: number;
    aircraft: string | null;
    operatingCarrier: string | null;
  };
};

async function postOfferRequest(
  query: FlightQuery,
  accessToken: string,
): Promise<DuffelOfferRequestResponse> {
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
        slices: [
          { origin: query.originIata, destination: query.destinationIata, departure_date: query.departureDate },
          { origin: query.destinationIata, destination: query.originIata, departure_date: query.returnDate },
        ],
        passengers: [{ type: "adult" }],
        cabin_class: "business",
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Record as soon as the request went out, win or lose - we don't know
  // Duffel's exact billing definition of "successful search", so count
  // conservatively (better to stop the budget early than overshoot it).
  const usage = recordRequest();
  console.log(`  [Duffel-Budget] ${usage.totalRequests} Requests, geschätzt ${usage.estimatedCostEur.toFixed(2)}€ von ${hardCapEur()}€`);

  const payload = (await response.json()) as DuffelOfferRequestResponse;

  if (response.status === 429) {
    throw new Error("rate_limited");
  }
  if (!response.ok) {
    const message = payload.errors?.map((e) => e.message).join("; ") ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

/**
 * Queries Duffel for Business Class offers on one route/date and returns
 * the cheapest offer per marketing airline, retrying once after a fixed
 * backoff if Duffel rate-limits the request.
 */
export async function fetchCheapestOffersByAirline(
  query: FlightQuery,
  accessToken: string,
): Promise<CheapestOfferByAirline[]> {
  assertBudgetAvailable(); // throws DuffelBudgetExceededError if the cost cap is reached - never skipped

  let payload: DuffelOfferRequestResponse;
  try {
    payload = await postOfferRequest(query, accessToken);
  } catch (error) {
    if ((error as Error).message === "rate_limited") {
      await sleep(RATE_LIMIT_RETRY_DELAY_MS);
      assertBudgetAvailable();
      payload = await postOfferRequest(query, accessToken);
    } else {
      throw error;
    }
  }

  const offers = payload.data?.offers ?? [];
  const cheapestByAirline = new Map<string, CheapestOfferByAirline>();

  for (const offer of offers) {
    const price = Number.parseFloat(offer.total_amount);
    if (!Number.isFinite(price)) continue;

    const existing = cheapestByAirline.get(offer.owner.iata_code);
    if (existing && existing.price <= price) continue;

    const slice = offer.slices[0];
    const segment = slice?.segments[0];
    const returnSlice = offer.slices[1];
    const returnSegment = returnSlice?.segments[0];

    cheapestByAirline.set(offer.owner.iata_code, {
      airlineIataCode: offer.owner.iata_code,
      price,
      currency: offer.total_currency,
      departureDate: segment?.departing_at?.slice(0, 10) ?? query.departureDate,
      returnDate: returnSegment?.departing_at?.slice(0, 10) ?? query.returnDate,
      raw: {
        offerId: offer.id,
        fareBrandName: slice?.fare_brand_name ?? null,
        stops: (slice?.segments.length ?? 1) - 1,
        aircraft: segment?.aircraft?.name ?? null,
        operatingCarrier: segment?.operating_carrier?.iata_code ?? null,
      },
    });
  }

  return [...cheapestByAirline.values()];
}

/**
 * Runs fetchCheapestOffersByAirline for a route across several round-trip
 * date pairs so the baseline engine (apps/worker/src/baseline.ts) has more
 * than one data point per (airline, route, cabin) to compare against - a
 * single snapshot can never be identified as "cheaper than usual". Waits a
 * fixed gap between requests to stay under Duffel's rate limit.
 */
export async function ingestDuffelRoute(
  query: {
    originIata: string;
    destinationIata: string;
    tripDates: Array<{ departure: string; return: string; nights: number }>;
    batchLabel?: string;
  },
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

  for (const [index, trip] of query.tripDates.entries()) {
    if (index > 0) await sleep(DELAY_BETWEEN_REQUESTS_MS);

    try {
      const offers = await fetchCheapestOffersByAirline(
        { originIata: query.originIata, destinationIata: query.destinationIata, departureDate: trip.departure, returnDate: trip.return },
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
            returnDate: new Date(offer.returnDate),
            nights: trip.nights,
            price: offer.price,
            currency: offer.currency,
            rawPayload: offer.raw,
            batchLabel: query.batchLabel,
          },
        });
        observationsCreated++;
      }
    } catch (error) {
      errors.push(`${query.originIata}->${query.destinationIata} on ${trip.departure}: ${(error as Error).message}`);
      if (error instanceof DuffelBudgetExceededError) break; // no point trying more dates/routes this run
    }
  }

  return { observationsCreated, errors };
}
