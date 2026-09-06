import { prisma } from "./prisma.js";

const MIN_HISTORY_SIZE = 3; // below this, we don't trust a median enough to call something a "deal"
const DEFAULT_DISCOUNT_THRESHOLD_PERCENT = 25;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * For every PriceObservation not yet linked to a Deal, compares it against
 * the median of all other observations for the same
 * (airline, origin, destination, cabin class). Flags it as a Deal when it
 * undercuts that baseline by at least `discountThresholdPercent`.
 */
export async function runBaselineCheck(
  discountThresholdPercent = DEFAULT_DISCOUNT_THRESHOLD_PERCENT,
): Promise<number> {
  const pendingObservations = await prisma.priceObservation.findMany({
    where: { deal: null },
    include: { source: true, airline: true },
    orderBy: { observedAt: "asc" },
  });

  let dealsCreated = 0;

  for (const observation of pendingObservations) {
    const history = await prisma.priceObservation.findMany({
      where: {
        airlineId: observation.airlineId,
        originAirportId: observation.originAirportId,
        destinationAirportId: observation.destinationAirportId,
        cabinClass: observation.cabinClass,
        id: { not: observation.id },
      },
      select: { price: true },
    });

    if (history.length < MIN_HISTORY_SIZE) continue;

    const baselinePrice = median(history.map((h) => Number(h.price)));
    const price = Number(observation.price);
    const discountPercent = ((baselinePrice - price) / baselinePrice) * 100;

    if (discountPercent >= discountThresholdPercent) {
      await prisma.deal.create({
        data: {
          priceObservationId: observation.id,
          baselinePrice,
          discountPercent,
          status: "CANDIDATE",
          clickoutUrl: observation.sourceUrl ?? observation.airline.websiteUrl ?? observation.source.baseUrl ?? "",
        },
      });
      dealsCreated++;
    }
  }

  return dealsCreated;
}
