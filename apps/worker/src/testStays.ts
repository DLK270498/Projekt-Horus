// One-off diagnostic, NOT part of the regular ingestion flow: checks
// whether Duffel Stays (their hotel search/booking product, separate
// from the Flights API we already use) is actually enabled and
// reachable on our account, with a real request rather than guessing
// from documentation. Costs at most one Duffel search (their published
// "excess search" fee only kicks in above a 1500-searches-per-booking
// ratio, so this alone is effectively free). Not wired into index.ts or
// maintenance.ts - point the worker service's Start Command at
// apps/worker/dist/testStays.js for one deploy to run it, then switch
// back.
const DUFFEL_API_BASE = "https://api.duffel.com";
const DUFFEL_API_VERSION = "v2";

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const accessToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("DUFFEL_ACCESS_TOKEN not set - cannot test Stays.");
    process.exitCode = 1;
    return;
  }

  const checkInDate = addDays(new Date().toISOString().slice(0, 10), 45);
  const checkOutDate = addDays(checkInDate, 2);

  console.log(`Testing Duffel Stays: searching hotels in Munich, ${checkInDate} - ${checkOutDate}...`);

  const response = await fetch(`${DUFFEL_API_BASE}/stays/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Duffel-Version": DUFFEL_API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        rooms: 1,
        location: {
          radius: 10,
          geographic_coordinates: { latitude: 48.1351, longitude: 11.5820 },
        },
        guests: [{ type: "adult" }],
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  console.log(`HTTP status: ${response.status}`);
  // Diagnostic-only script probing an undocumented-to-us response shape -
  // `any` is deliberate here, not a shortcut around real typed code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (await response.json()) as any;

  if (!response.ok) {
    console.error("Duffel Stays request failed:", JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  const results = payload.data?.results ?? payload.data ?? [];
  const count = Array.isArray(results) ? results.length : "unknown";
  console.log(`Success! Got ${count} result(s) back.`);
  console.log("First 2 results (raw):", JSON.stringify((Array.isArray(results) ? results : []).slice(0, 2), null, 2));
}

main()
  .catch((error) => {
    console.error("testStays.ts crashed:", error);
    process.exitCode = 1;
  });
