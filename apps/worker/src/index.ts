import { runBaselineCheck } from "./baseline.js";
import { ingestDuffelRoute } from "./duffelClient.js";
import { getUsage, DuffelBudgetExceededError } from "./duffelBudget.js";
import { prisma } from "./prisma.js";

// Forum/RSS crawling is disabled by default for now: of the 4 sources, 3
// return nothing usable (blocked or dead) and the one that works finds no
// matching posts currently (see project notes). The code in forumCrawler.ts
// still works and is worth re-enabling once better sources are found -
// `import { runForumCrawlers } from "./forumCrawler.js";` and call it below.

// Routes/dates queried against Duffel per run, prioritized rather than
// brute-forced: our strongest German hubs (FRA/MUC/DUS/BER), one route per
// major world region, 3 dates each (the minimum baseline.ts needs to trust
// a median). Keeps each run's request count - and therefore cost - small
// and predictable; see duffelBudget.ts for the hard spending cap.
const DUFFEL_ROUTES: Array<{ originIata: string; destinationIata: string; departureDates: string[] }> = [
  { originIata: "FRA", destinationIata: "JFK", departureDates: ["2026-10-20", "2026-12-01", "2027-01-15"] }, // North America
  { originIata: "MUC", destinationIata: "BKK", departureDates: ["2026-10-22", "2026-12-03", "2027-01-18"] }, // SE Asia
  { originIata: "FRA", destinationIata: "SIN", departureDates: ["2026-10-25", "2026-12-05", "2027-01-20"] }, // SE Asia hub
  { originIata: "DUS", destinationIata: "DXB", departureDates: ["2026-10-28", "2026-12-08", "2027-01-22"] }, // Middle East
  { originIata: "BER", destinationIata: "ICN", departureDates: ["2026-10-30", "2026-12-10", "2027-01-25"] }, // NE Asia
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
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (!duffelToken) {
    console.warn("DUFFEL_ACCESS_TOKEN not set - skipping Duffel ingestion.");
  } else {
    console.log(`Querying Duffel for ${DUFFEL_ROUTES.length} route(s)...`);
    for (const route of DUFFEL_ROUTES) {
      const result = await ingestDuffelRoute(route, duffelToken);
      console.log(`${route.originIata} -> ${route.destinationIata}:`, result);

      if (result.errors.some((e) => e.includes("Duffel-Budget"))) {
        console.error("Duffel-Budget erreicht - breche weitere Routen ab.");
        break;
      }
    }
    const usage = getUsage();
    console.log(`Duffel-Nutzung insgesamt: ${usage.totalRequests} Requests, geschätzt ${usage.estimatedCostEur.toFixed(2)}€.`);
  }

  console.log("Running baseline/deal-detection pass...");
  const dealsCreated = await runBaselineCheck();
  console.log(`Created ${dealsCreated} new deal(s).`);
}

main()
  .catch((error) => {
    if (error instanceof DuffelBudgetExceededError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
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
