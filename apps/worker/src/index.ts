import { runForumCrawlers } from "./forumCrawler.js";
import { runBaselineCheck } from "./baseline.js";
import { ingestDuffelRoute } from "./duffelClient.js";
import { prisma } from "./prisma.js";

// Routes/dates queried against Duffel per run. Several dates per route so
// the baseline engine has more than one data point per (airline, route,
// cabin) to compare against - see baseline.ts.
const DUFFEL_ROUTES: Array<{ originIata: string; destinationIata: string; departureDates: string[] }> = [
  { originIata: "FRA", destinationIata: "JFK", departureDates: ["2026-10-20", "2026-11-10", "2026-12-05", "2027-01-15"] },
  { originIata: "MUC", destinationIata: "BKK", departureDates: ["2026-10-22", "2026-11-12", "2026-12-08", "2027-01-18"] },
  { originIata: "FRA", destinationIata: "SIN", departureDates: ["2026-10-25", "2026-11-15", "2026-12-10", "2027-01-20"] },
];

// Safety net: if anything hangs (a fetch without its own timeout, a stuck
// browser page, ...) despite the per-request timeouts already in place
// elsewhere, force-exit rather than leave a runaway process behind.
// unref() means this alone won't keep the process alive - it only fires if
// something else already is.
const MAX_RUNTIME_MS = 3 * 60 * 1000;
const watchdog = setTimeout(() => {
  console.error(`Worker exceeded max runtime of ${MAX_RUNTIME_MS}ms - force-exiting.`);
  process.exit(1);
}, MAX_RUNTIME_MS);
watchdog.unref();

async function main() {
  console.log("Running forum/RSS crawlers...");
  const forumResults = await runForumCrawlers();
  console.log(forumResults);

  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (!duffelToken) {
    console.warn("DUFFEL_ACCESS_TOKEN not set - skipping Duffel ingestion.");
  } else {
    console.log(`Querying Duffel for ${DUFFEL_ROUTES.length} route(s)...`);
    for (const route of DUFFEL_ROUTES) {
      const result = await ingestDuffelRoute(route, duffelToken);
      console.log(`${route.originIata} -> ${route.destinationIata}:`, result);
    }
  }

  console.log("Running baseline/deal-detection pass...");
  const dealsCreated = await runBaselineCheck();
  console.log(`Created ${dealsCreated} new deal(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // NODE_USE_ENV_PROXY's global dispatcher (and possibly other libraries
    // we pull in) can leave keep-alive sockets open, which stalls Node's
    // natural exit indefinitely instead of just ending the process — this
    // run took 40+ minutes to notice as a hung process rather than exiting
    // in seconds. Force-exit once our own work is done rather than trusting
    // the event loop to drain on its own.
    process.exit(process.exitCode ?? 0);
  });
