import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Duffel bills the "excess search fee" ($0.005/search once you exceed a
 * 1500-searches-per-booking ratio) monthly, after the fact - there is no
 * live balance/usage endpoint to check spend against in real time. So this
 * tracks OUR OWN request count persistently (survives across worker runs)
 * and refuses further live requests once the estimated cost hits the cap.
 *
 * The per-request cost is deliberately doubled from Duffel's published
 * $0.005 (treated 1:1 as EUR) as a safety margin against fee-model
 * uncertainty - this is an estimate to stay well clear of the real
 * invoice, not a substitute for checking Duffel's own billing dashboard.
 */
const ESTIMATED_COST_PER_REQUEST_EUR = 0.01;
// Raised from 5€ to 11€ (user authorized ~7€ more on top of the 3.75€
// already spent) after the round-trip fix required re-querying from
// scratch. Duffel's own dashboard showed a 0.00€ balance even after the
// first ~375 requests, suggesting the excess-search fee bills later/
// differently than assumed - kept conservative here regardless, since
// that can't be confirmed live (see comment below).
const HARD_CAP_EUR = 11;

const __dirname = dirname(fileURLToPath(import.meta.url));
const USAGE_FILE = join(__dirname, "..", ".duffel-usage.json");

type UsageState = { totalRequests: number; estimatedCostEur: number };

function readUsage(): UsageState {
  if (!existsSync(USAGE_FILE)) return { totalRequests: 0, estimatedCostEur: 0 };
  try {
    return JSON.parse(readFileSync(USAGE_FILE, "utf-8"));
  } catch {
    return { totalRequests: 0, estimatedCostEur: 0 };
  }
}

function writeUsage(usage: UsageState) {
  writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

export class DuffelBudgetExceededError extends Error {}

/**
 * Call before every live Duffel search request. Throws if the cumulative
 * estimated cost would exceed the hard cap - callers must not make the
 * request in that case.
 */
export function assertBudgetAvailable(): void {
  const usage = readUsage();
  if (usage.estimatedCostEur + ESTIMATED_COST_PER_REQUEST_EUR > HARD_CAP_EUR) {
    throw new DuffelBudgetExceededError(
      `Duffel-Budget erschöpft: geschätzt ${usage.estimatedCostEur.toFixed(2)}€ von ${HARD_CAP_EUR}€ bereits verbraucht (${usage.totalRequests} Requests). Weitere Live-Requests werden blockiert.`,
    );
  }
}

export function hardCapEur(): number {
  return HARD_CAP_EUR;
}

/** Call immediately after a successful live Duffel search request. */
export function recordRequest(): UsageState {
  const usage = readUsage();
  usage.totalRequests += 1;
  usage.estimatedCostEur += ESTIMATED_COST_PER_REQUEST_EUR;
  writeUsage(usage);
  return usage;
}

export function getUsage(): UsageState {
  return readUsage();
}
