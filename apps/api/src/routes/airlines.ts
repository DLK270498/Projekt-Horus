import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";

export async function airlineRoutes(app: FastifyInstance) {
  app.get("/airlines", async () => {
    const airlines = await prisma.airline.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return airlines;
  });
}
