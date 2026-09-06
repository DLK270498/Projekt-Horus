import { runForumCrawlers } from "./forumCrawler.js";
import { runBaselineCheck } from "./baseline.js";
import { scrapeGoogleFlightsBusinessClass } from "./googleFlightsScraper.js";
import { prisma } from "./prisma.js";

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
  });
