import { runBaselineCheck } from "./baseline.js";
import { ingestDuffelRoute } from "./duffelClient.js";
import { getUsage, DuffelBudgetExceededError } from "./duffelBudget.js";
import { prisma } from "./prisma.js";

// Forum/RSS crawling is disabled by default for now: of the 4 sources, 3
// return nothing usable (blocked or dead) and the one that works finds no
// matching posts currently (see project notes). The code in forumCrawler.ts
// still works and is worth re-enabling once better sources are found -
// `import { runForumCrawlers } from "./forumCrawler.js";` and call it below.

// THIRD sampling round (2026-09, see git history for rounds 1-2). User
// feedback after reviewing 110 real deals: too many were premium-tier
// long-haul (North America, Premium Asia) that structurally never gets
// below ~3,000€ round-trip business even at a real discount, and the same
// handful of destinations (e.g. Delhi) showed up many times over. This
// round targets destinations plausibly served by value-oriented carriers
// (Turkish, Ethiopian, Gulf connections, local flag carriers) that are
// more likely to actually land in a 2,000-2,500€ round-trip band - see
// packages/db/prisma/seed.ts for the new airports added for this batch.
// Short/medium-haul (e.g. Athens) is deliberately excluded - explicitly
// long-haul only per the user's request.
const MUC_ROUTES: string[] = [
  // Kept from rounds 1-2 - already producing sub-2,700€ deals or plausible
  // candidates for the target band.
  "GRU", "JNB", "BOM", "SEA", "DXB", "SIN", "HKG", "ICN", "PEK", "PVG",
  "DEL", "BKK", "CPT", "CUN", "PUJ",
  // North America dropped for this batch - every prior observation landed
  // well above the target band (2,700€-5,700€) regardless of date.
  // New for this round - value/leisure long-haul markets not tried yet.
  "NBO", "ADD", "CMB", "MLE", "KUL", "MNL", "SGN", "HAN", "LOS", "ACC",
  "DAC", "MRU",
];

// Anti-cyclical dates, offset from rounds 1-2 (see git history) so this
// batch samples periods we don't already have data for. Nudged around
// Bavaria's 2026/2027 school-holiday windows same as before.
const OFF_PEAK_DEPARTURE_DATES: string[] = [
  "2026-09-13",
  "2026-10-01",
  "2026-12-08",
  "2027-01-12",
  "2027-04-13",
  "2027-06-15",
];

// User wants to filter results by minimum time on the ground (>=1/2/3
// weeks) - querying multiple actual trip lengths gives every band real
// data to filter against, instead of everything being stuck at one fixed
// duration. Round-trip business fares don't vary much with trip length
// itself (route/season/day-of-week drive price far more), so these three
// values are just samples across the bands users can filter by, not an
// attempt to find the "best" duration.
const TRIP_LENGTHS_NIGHTS = [7, 14, 21];

// Tags every observation from this run so the frontend can compare this
// batch against older data before anything gets deleted.
const BATCH_LABEL = "2026-09-06-longhaul-v3";

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const TRIP_DATES = OFF_PEAK_DEPARTURE_DATES.flatMap((departure) =>
  TRIP_LENGTHS_NIGHTS.map((nights) => ({
    departure,
    return: addDays(departure, nights),
    nights,
  })),
);

const DUFFEL_ROUTES = MUC_ROUTES.map((destinationIata) => ({
  originIata: "MUC",
  destinationIata,
  tripDates: TRIP_DATES,
  batchLabel: BATCH_LABEL,
}));

// Safety net: if anything hangs (a fetch without its own timeout, a stuck
// browser page, ...) despite the per-request timeouts already in place
// elsewhere, force-exit rather than leave a runaway process behind.
// unref() means this alone won't keep the process alive - it only fires if
// something else already is. Sized generously for this run's ~560 Duffel
// requests (31 routes x 6 dates x 3 trip lengths) at ~1.5-2s each (request
// + rate-limit delay) plus response time - roughly double rounds 1-2.
const MAX_RUNTIME_MS = 55 * 60 * 1000;
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
    console.log(
      `Querying Duffel for ${DUFFEL_ROUTES.length} route(s) x ${OFF_PEAK_DEPARTURE_DATES.length} date(s) x ${TRIP_LENGTHS_NIGHTS.length} trip length(s) (batch "${BATCH_LABEL}")...`,
    );
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
