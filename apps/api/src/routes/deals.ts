import type { FastifyInstance } from "fastify";
import type { HaulType } from "@horus/db";
import { prisma } from "../prisma.js";

type DealQuery = {
  origin?: string;
  destination?: string;
  airline?: string;
  minRating?: string;
  maxPrice?: string;
  minDiscount?: string;
  haulType?: string;
  onlyRealDeals?: string;
  fromDate?: string;
  toDate?: string;
};

export async function dealRoutes(app: FastifyInstance) {
  app.get<{ Querystring: DealQuery }>("/deals", async (request) => {
    const { origin, destination, airline, minRating, maxPrice, minDiscount, haulType, onlyRealDeals, fromDate, toDate } = request.query;

    // A "real" deal has a baseline-computed discount (SCRAPER/API sources,
    // e.g. Duffel); forum-curated posts land in the same table with
    // discountPercent 0 since there's no price history to compare against
    // yet (see apps/worker/src/forumCrawler.ts).
    const minDiscountFilter = onlyRealDeals === "true" ? Math.max(0.01, Number(minDiscount) || 0) : Number(minDiscount) || undefined;

    const deals = await prisma.deal.findMany({
      where: {
        status: { in: ["CANDIDATE", "PUBLISHED"] },
        discountPercent: minDiscountFilter ? { gte: minDiscountFilter } : undefined,
        priceObservation: {
          price: maxPrice ? { lte: Number(maxPrice) } : undefined,
          departureDate:
            fromDate || toDate
              ? { gte: fromDate ? new Date(fromDate) : undefined, lte: toDate ? new Date(toDate) : undefined }
              : undefined,
          originAirport: origin ? { iataCode: origin.toUpperCase() } : undefined,
          destinationAirport: destination ? { iataCode: destination.toUpperCase() } : undefined,
          airline: {
            iataCode: airline ? airline.toUpperCase() : undefined,
            skytraxRating: minRating ? { gte: Number(minRating) } : undefined,
            haulTypes: haulType ? { has: haulType.toUpperCase() as HaulType } : undefined,
          },
        },
      },
      include: {
        priceObservation: {
          include: { airline: true, originAirport: true, destinationAirport: true },
        },
      },
      orderBy: { priceObservation: { price: "asc" } },
      take: 200,
    });

    return deals.map((deal) => ({
      id: deal.id,
      price: Number(deal.priceObservation.price),
      currency: deal.priceObservation.currency,
      baselinePrice: Number(deal.baselinePrice),
      discountPercent: Number(deal.discountPercent),
      isRealDeal: Number(deal.discountPercent) > 0,
      cabinClass: deal.priceObservation.cabinClass,
      departureDate: deal.priceObservation.departureDate,
      returnDate: deal.priceObservation.returnDate,
      clickoutUrl: deal.clickoutUrl,
      clickoutCheckedAt: deal.clickoutCheckedAt,
      clickoutIsValid: deal.clickoutIsValid,
      airline: {
        iataCode: deal.priceObservation.airline.iataCode,
        name: deal.priceObservation.airline.name,
        skytraxRating: deal.priceObservation.airline.skytraxRating,
        haulTypes: deal.priceObservation.airline.haulTypes,
      },
      origin: {
        iataCode: deal.priceObservation.originAirport.iataCode,
        city: deal.priceObservation.originAirport.city,
      },
      destination: {
        iataCode: deal.priceObservation.destinationAirport.iataCode,
        city: deal.priceObservation.destinationAirport.city,
      },
    }));
  });
}
