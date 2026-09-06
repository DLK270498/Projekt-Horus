import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function airportRoutes(app: FastifyInstance) {
  app.get("/airports", async () => {
    return prisma.airport.findMany({ orderBy: { city: "asc" } });
  });
}
