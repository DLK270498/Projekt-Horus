import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { airlineRoutes } from "./routes/airlines.js";
import { airportRoutes } from "./routes/airports.js";
import { dealRoutes } from "./routes/deals.js";

const app = Fastify({ logger: true });

app.addHook("onSend", async (_request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
});

await app.register(healthRoutes);
await app.register(airlineRoutes);
await app.register(airportRoutes);
await app.register(dealRoutes);

const port = Number(process.env.API_PORT ?? 4000);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
