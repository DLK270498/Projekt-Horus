import { runForumCrawlers } from "./forumCrawler.js";
import { runBaselineCheck } from "./baseline.js";
import { scrapeGoogleFlightsBusinessClass } from "./googleFlightsScraper.js";
import { prisma } from "./prisma.js";

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

  console.log("Attempting Google Flights scrape (FRA -> New York)...");
  try {
    const result = await scrapeGoogleFlightsBusinessClass({
      originQuery: "Frankfurt",
      destinationQuery: "New York",
    });
    console.log("Google Flights result:", result);
  } catch (error) {
    console.error("Google Flights scrape failed:", (error as Error).message);
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
