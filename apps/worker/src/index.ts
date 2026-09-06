import { runBaselineCheck } from "./baseline.js";
import { ingestDuffelRoute } from "./duffelClient.js";
import { getUsage, DuffelBudgetExceededError } from "./duffelBudget.js";
import { ensureFourthRoundSeed } from "./ensureFourthRoundSeed.js";
import { prisma } from "./prisma.js";

// Forum/RSS crawling is disabled by default for now: of the 4 sources, 3
// return nothing usable (blocked or dead) and the one that works finds no
// matching posts currently (see project notes). The code in forumCrawler.ts
// still works and is worth re-enabling once better sources are found -
// `import { runForumCrawlers } from "./forumCrawler.js";` and call it below.

// FOURTH sampling round (2026-09, see git history for rounds 1-3). Round 3
// found 128 deals but only 9 under 2,000€; analysis of that data showed
// every one of the cheapest results came from an airline connecting via a
// secondary hub away from Munich's own Lufthansa-Group network (British
// Airways via London to Accra: 1,364€; Turkish via Istanbul to Nairobi:
// 1,924€; Etihad via Abu Dhabi, LOT via Warsaw, TAP via Lisbon - all
// meaningfully cheaper than direct/Lufthansa-Group pricing on comparable
// routes). Our airline longlist was missing most of this carrier category
// entirely (Ethiopian, Kenya Airways, EgyptAir, Air India, Royal Air
// Maroc, Royal Jordanian, Saudia, Gulf Air, Oman Air, RwandAir, Avianca,
// LATAM, Garuda - see packages/db/prisma/seed.ts), which means
// fetchCheapestOffersByAirline (duffelClient.ts) was silently discarding
// any offer Duffel already returned for them - real deals we'd already
// paid for and thrown away. This round both adds those carriers and adds
// destinations they plausibly serve cheaply, while explicitly avoiding
// picks with no genuine tourism draw (user: "nicht Süd Sudan oder so").
const MUC_ROUTES: string[] = [
  // Kept from round 3 - still worth re-sampling now that the longlist
  // covers the carriers actually undercutting these routes.
  "GRU", "JNB", "BOM", "SEA", "DXB", "SIN", "HKG", "ICN", "PEK", "PVG",
  "DEL", "BKK", "CPT", "CUN", "PUJ",
  "NBO", "ADD", "CMB", "MLE", "KUL", "MNL", "SGN", "HAN", "LOS", "ACC",
  "DAC", "MRU",
  // New for this round - appealing leisure destinations plausibly reached
  // cheaply via the newly-added value-hub carriers (Ethiopian/Kenya
  // Airways/Turkish for East Africa, TAP for Brazil, Avianca for
  // Colombia, Garuda/Etihad/Turkish for Jakarta).
  "SEZ", "ZNZ", "KGL", "GIG", "SSA", "BOG", "CGK",
  // User-requested additions (Tokyo already seeded as HND but never
  // routed; Bali/Denpasar newly seeded as DPS) - Bali explicitly called
  // out as a personal interest, tracked regardless of proven price yet.
  "HND", "DPS",
];

// User suggestion: also try Frankfurt. FRA is Lufthansa's main long-haul
// hub with substantially more direct/one-stop African and South Asian
// capacity than MUC (e.g. Lufthansa itself flies FRA-NBO and FRA-LOS
// direct; Ethiopian, EgyptAir and other value carriers connect more
// easily via FRA), so the same destination can plausibly price lower
// from there. Scoped to the Africa/South Asia/new-Latin-America cluster
// where that hub advantage is real, rather than re-querying every MUC
// destination a second time from FRA - the Far East/Pacific destinations
// (Seoul, Hong Kong, Bangkok etc.) don't have the same FRA-specific edge
// and doubling the whole route list wasn't worth the extra spend.
const FRA_ROUTES: string[] = [
  "NBO", "ADD", "LOS", "ACC", "JNB", "CPT", "MRU", "KGL", "ZNZ", "SEZ",
  "BOM", "DEL", "DAC", "CMB", "BOG", "GIG", "SSA",
];

// Anti-cyclical dates, offset from rounds 1-3 (see git history) so this
// batch samples periods we don't already have data for. Nudged around
// Bavaria's 2026/2027 school-holiday windows same as before, spread over
// a longer ~14-month window for more chances to land on a fare dip.
const OFF_PEAK_DEPARTURE_DATES: string[] = [
  "2026-09-21",
  "2026-10-19",
  "2026-11-09",
  "2026-12-01",
  "2027-01-25",
  "2027-02-08",
  "2027-03-15",
  "2027-05-10",
  "2027-07-06",
  "2027-08-24",
];

// Round 3 queried 7/14/21 nights per date but the resulting prices were
// nearly identical across all three for the same route/date (round-trip
// business fares are driven by route+carrier+date, not trip length) - a
// third of that round's budget bought no real extra information. Sampling
// just the two extremes still covers every "≥1/2/3 weeks" frontend filter
// band correctly (a 21-night observation satisfies gte 7/14/21 alike),
// freeing that budget for more dates and destinations instead.
const TRIP_LENGTHS_NIGHTS = [7, 21];

// Tags every observation from this run so the frontend can compare this
// batch against older data before anything gets deleted.
const BATCH_LABEL = "2026-09-06-valuehubs-v4";

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

const DUFFEL_ROUTES = [
  ...MUC_ROUTES.map((destinationIata) => ({ originIata: "MUC", destinationIata, tripDates: TRIP_DATES, batchLabel: BATCH_LABEL })),
  ...FRA_ROUTES.map((destinationIata) => ({ originIata: "FRA", destinationIata, tripDates: TRIP_DATES, batchLabel: BATCH_LABEL })),
];

// Safety net: if anything hangs (a fetch without its own timeout, a stuck
// browser page, ...) despite the per-request timeouts already in place
// elsewhere, force-exit rather than leave a runaway process behind.
// unref() means this alone won't keep the process alive - it only fires if
// something else already is. Sized generously for this run's ~1,060 Duffel
// requests ((36 MUC + 17 FRA routes) x 10 dates x 2 trip lengths) at
// ~1.5-2s each (request + rate-limit delay) plus response time.
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
    await ensureFourthRoundSeed();
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
