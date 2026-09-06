import { ingestDuffelRoute } from "./duffelClient.js";
import { getUsage, DuffelBudgetExceededError } from "./duffelBudget.js";
import { ensureFourthRoundSeed } from "./ensureFourthRoundSeed.js";
import { runBaselineCheck } from "./baseline.js";
import { prisma } from "./prisma.js";

// Separate, intentionally cheap entrypoint from index.ts's big one-off
// "exploration" rounds (~700-1,000+ Duffel requests, ~10-30€, run manually
// whenever we want to test new carriers/destinations/date ranges). This
// script exists to answer "keep the fares we already know are good
// fresh" WITHOUT repeating that full exploration every time - see chat
// history: user asked whether ~30€/day was really necessary just to have
// current prices, which it isn't. Meant to run on a schedule (Railway
// Cron Schedule on its own service, separate from the exploration
// worker's manually-triggered one-off runs) - weekly is plenty, since
// round-trip business fares many months out don't meaningfully move
// day-to-day; this is refresh, not discovery.
//
// Curated from round 3's actual results (see git history /
// apps/worker/src/index.ts) - the destinations that already produced
// real sub-3,000€ round-trip business fares, cheapest first. Revisit
// this list after each exploration round: fold in new winners (e.g. the
// "value hub" carrier round's Seychelles/Zanzibar/Rio/etc. destinations,
// once evaluated), drop anything that stops paying off.
const MAINTENANCE_ROUTES: string[] = [
  "ACC", "NBO", "HKG", "ICN", "GRU", "JNB", "CPT", "BKK", "SGN", "SIN",
  "MNL", "KUL", "PVG",
];

const PEAK_MONTHS = new Set([6, 7, 11]); // July, August, December (0-indexed) - Bavarian summer/Christmas peak

function addMonthsAvoidingPeak(monthsFromNow: number): string {
  const date = new Date();
  date.setUTCDate(15); // mid-month, clear of month-end edge cases
  date.setUTCMonth(date.getUTCMonth() + monthsFromNow);
  while (PEAK_MONTHS.has(date.getUTCMonth())) {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// A handful of dates spread across the coming year, recalculated relative
// to "today" every run so the window naturally rolls forward - no
// hand-picked date list to keep updating like index.ts's exploration
// rounds need.
const DEPARTURE_DATES = [5, 8, 11].map((months) => addMonthsAvoidingPeak(months));

// Round 3 data showed round-trip business price barely varies with trip
// length - two samples per date still covers every "≥1/2/3 weeks"
// frontend filter band (see apps/worker/src/index.ts for the full
// reasoning) without tripling the request count.
const TRIP_LENGTHS_NIGHTS = [7, 21];

const TRIP_DATES = DEPARTURE_DATES.flatMap((departure) =>
  TRIP_LENGTHS_NIGHTS.map((nights) => ({ departure, return: addDays(departure, nights), nights })),
);

// Not tagged with a one-off batch label like index.ts's exploration
// rounds - this is meant to blend into the regular pool of observations
// that keeps every route's baseline current, not a snapshot to compare
// against other snapshots.
const BATCH_LABEL = "maintenance";

const DUFFEL_ROUTES = MAINTENANCE_ROUTES.map((destinationIata) => ({
  originIata: "MUC",
  destinationIata,
  tripDates: TRIP_DATES,
  batchLabel: BATCH_LABEL,
}));

// Same defensive force-exit pattern as index.ts, sized down for this
// script's much smaller ~80-request run (13 routes x 3 dates x 2 trip
// lengths).
const MAX_RUNTIME_MS = 10 * 60 * 1000;
const watchdog = setTimeout(() => {
  console.error(`Maintenance worker exceeded max runtime of ${MAX_RUNTIME_MS}ms - force-exiting.`);
  process.exit(1);
}, MAX_RUNTIME_MS);
watchdog.unref();

async function main() {
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (!duffelToken) {
    console.warn("DUFFEL_ACCESS_TOKEN not set - skipping Duffel maintenance refresh.");
    return;
  }

  await ensureFourthRoundSeed();
  console.log(
    `Maintenance refresh: ${DUFFEL_ROUTES.length} route(s) x ${DEPARTURE_DATES.length} date(s) x ${TRIP_LENGTHS_NIGHTS.length} trip length(s)...`,
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
    process.exit(process.exitCode ?? 0);
  });
