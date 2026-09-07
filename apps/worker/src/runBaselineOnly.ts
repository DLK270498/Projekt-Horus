import { runBaselineCheck } from "./baseline.js";
import { prisma } from "./prisma.js";

// Recovery tool: the ingestion run that hit index.ts's old hard watchdog
// timeout got force-exited (process.exit) before ever reaching its
// runBaselineCheck() call, even though it had already made ~925 real,
// paid Duffel requests and written all those PriceObservation rows to the
// DB. runBaselineCheck is pure DB computation - no Duffel calls, no cost -
// so this recovers real deals from data we already paid for instead of
// re-spending anything. Point the worker service's Start Command at
// `node apps/worker/dist/runBaselineOnly.js` for one deploy, confirm
// deals appear, then switch it back to index.js for the next real
// exploration round.
async function main() {
  console.log("Running baseline/deal-detection pass only (no Duffel calls, no cost)...");
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
    process.exit(process.exitCode ?? 0);
  });
