import { runBaselineCheck } from "./baseline.js";
import { ingestDuffelRoute } from "./duffelClient.js";
import { getUsage, DuffelBudgetExceededError } from "./duffelBudget.js";
import { prisma } from "./prisma.js";

// Forum/RSS crawling is disabled by default for now: of the 4 sources, 3
// return nothing usable (blocked or dead) and the one that works finds no
// matching posts currently (see project notes). The code in forumCrawler.ts
// still works and is worth re-enabling once better sources are found -
// `import { runForumCrawlers } from "./forumCrawler.js";` and call it below.

// Munich-only for now, and route-selected rather than brute-forced, based
// on real signals researched 2026-09 (see chat): Lufthansa is adding new
// Munich long-haul routes (Sao Paulo, Johannesburg) and upgauging others
// (Mumbai to A380) for 2026 - new/growing routes carry promotional fares
// while airlines build demand and fill the extra capacity. Established
// competitive hubs (multiple airlines flying the same city pair) are
// included too since competition is the other classic source of real
// discounting. Asia-Pacific long-haul is currently reported as
// capacity-constrained with firming fares (Middle East airspace
// restrictions), so it's included for comparison but not over-weighted.
const MUC_ROUTES: string[] = [
  "GRU", "JNB", "BOM", "SEA", // new/upgauged Munich routes - launch-fare candidates
  "JFK", "ORD", "LAX", "YYZ", // competitive North America
  "DXB", // competitive Middle East hub
  "SIN", "HKG", "ICN", "PEK", "PVG", "DEL", "BKK", // Asia (comparison, currently reported capacity-constrained)
  "CPT", // seasonal leisure/business mix, Southern Hemisphere counter-season
  "CUN", "PUJ", "ATH", // leisure-heavy long/mid-haul, more price-elastic historically
];

// Departure dates deliberately avoid German (Bavaria) peak-travel windows
// (Christmas/New Year, Fasching, Easter, Pentecost, autumn half-term,
// summer school holidays) where fares are structurally higher regardless
// of any underlying "deal" - an anti-cyclical sample is more likely to
// catch genuine troughs. Same date set for every route to keep the
// request count predictable; extend/refine per-destination seasonality
// later if the data warrants it.
//
// This is the SECOND sampling round - deliberately offset from the first
// round's dates (2026-09-15 through 2027-06-01, see git history) so this
// run adds new historical data points instead of re-querying periods we
// already have observations for. Each date was nudged to skip Bavaria's
// 2026/2027 school-holiday windows (autumn ~Nov 2-6, Fasching ~Feb 15-19,
// Easter ~late Mar/early Apr).
const OFF_PEAK_DEPARTURE_DATES: string[] = [
  "2026-09-22",
  "2026-10-06",
  "2026-10-20",
  "2026-10-30",
  "2026-11-17",
  "2026-12-01",
  "2027-01-26",
  "2027-02-09",
  "2027-02-23",
  "2027-03-09",
  "2027-03-23",
  "2027-05-11",
  "2027-05-25",
  "2027-06-08",
];

// Round-trip business fares are what "a deal" means in this market (see
// duffelClient.ts) - one-way pricing follows different, disproportionate
// economics and isn't comparable. 9 nights is a plausible length for a
// long-haul business trip (a working week plus travel days) without being
// so long it reads as a leisure holiday.
const TRIP_LENGTH_NIGHTS = 9;

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const DUFFEL_ROUTES = MUC_ROUTES.map((destinationIata) => ({
  originIata: "MUC",
  destinationIata,
  tripDates: OFF_PEAK_DEPARTURE_DATES.map((departure) => ({
    departure,
    return: addDays(departure, TRIP_LENGTH_NIGHTS),
  })),
}));

// Safety net: if anything hangs (a fetch without its own timeout, a stuck
// browser page, ...) despite the per-request timeouts already in place
// elsewhere, force-exit rather than leave a runaway process behind.
// unref() means this alone won't keep the process alive - it only fires if
// something else already is. Sized generously for this run's ~280 Duffel
// requests at ~1.5-2s each (request + rate-limit delay) plus response time.
const MAX_RUNTIME_MS = 25 * 60 * 1000;
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
    console.log(`Querying Duffel for ${DUFFEL_ROUTES.length} route(s) x ${OFF_PEAK_DEPARTURE_DATES.length} date(s)...`);
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
