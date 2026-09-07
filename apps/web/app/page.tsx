import { googleFlightsUrl } from "./googleFlights";
import { FilterBar } from "./FilterBar";

type Deal = {
  id: string;
  price: number;
  currency: string;
  baselinePrice: number;
  discountPercent: number;
  isRealDeal: boolean;
  cabinClass: string;
  departureDate: string | null;
  returnDate: string | null;
  nights: number | null;
  batchLabel: string | null;
  stops: number | null;
  aircraft: string | null;
  fareBrandName: string | null;
  clickoutUrl: string;
  clickoutCheckedAt: string | null;
  clickoutIsValid: boolean;
  airline: { iataCode: string; name: string; skytraxRating: number; haulTypes: string[] };
  origin: { iataCode: string; city: string };
  destination: { iataCode: string; city: string };
};

type Airline = { id: string; iataCode: string; name: string };
type Airport = { id: string; iataCode: string; city: string };

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

async function getJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const query = params
    ? Object.entries(params).filter(([, value]) => value)
    : [];
  const qs = query.length > 0 ? `?${new URLSearchParams(query as [string, string][]).toString()}` : "";
  const res = await fetch(`${API_URL}${path}${qs}`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Request failed: ${path} (${res.status})`);
  }

  return res.json();
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(price);
}

// All secondary/muted ("shadow") text across the page shares this size -
// previously these drifted between text-xs and text-sm depending on where
// they were added.
const MUTED_TEXT_CLASS = "text-xs text-slate-400";

// Every small rounded "pill" on a deal card (date range, nights, discount,
// community-deal) shares this exact size/padding - previously the
// discount/community pill used text-sm/px-3 while the others used
// text-xs/px-2.5, so pills on the same card were visibly different sizes.
const PILL_CLASS = "rounded-full px-2.5 py-1 text-xs font-medium";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = await searchParams;
  const param = (key: string) => (typeof rawParams[key] === "string" ? (rawParams[key] as string) : undefined);

  const filters = {
    origin: param("origin"),
    destination: param("destination"),
    airline: param("airline"),
    minRating: param("minRating"),
    maxPrice: param("maxPrice"),
    minDiscount: param("minDiscount"),
    haulType: param("haulType"),
    onlyRealDeals: param("onlyRealDeals"),
    fromDate: param("fromDate"),
    toDate: param("toDate"),
    minNights: param("minNights"),
    batch: param("batch"),
  };

  const [deals, airlines, airports] = await Promise.all([
    getJson<Deal[]>("/deals", filters),
    getJson<Airline[]>("/airlines"),
    getJson<Airport[]>("/airports"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-800 shadow-lg shadow-sky-500/20">
            <svg viewBox="0 0 32 20" className="h-5 w-7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 16 Q9 4 16 14 Q23 4 30 16" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Horus</h1>
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-8 -mx-6 border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
        {/* Client Component: submitting via router.push (instead of a
            native form GET) triggers Next's client-side navigation, which
            shows loading.tsx's skeleton while this page's Server
            Component re-fetches - a plain form GET would instead do a
            full hard page reload with no perceptible loading state. */}
        <FilterBar airlines={airlines} airports={airports} />
      </div>

      <section className="mt-8">
        {deals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
            <p className="font-medium text-slate-300">Noch keine Deals gefunden.</p>
            <p className="mt-2 text-sm">
              Der Scraper braucht mindestens 3 Preisbeobachtungen je Route/Airline, bevor er
              eine Baseline berechnen und Deals erkennen kann — oder die Filter sind zu eng
              gewählt. Passe die Filter an oder warte auf den nächsten Crawl-Lauf.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => (
                <article
                  key={deal.id}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-slate-700"
                >
                  {deal.isRealDeal && (
                    <span className={`absolute right-3 top-3 bg-emerald-500 font-bold text-slate-950 shadow-lg ${PILL_CLASS}`}>
                      Deal
                    </span>
                  )}
                  <div>
                    <div className={`flex items-center justify-between gap-2 pr-16 ${MUTED_TEXT_CLASS}`}>
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                          <img
                            src={`https://images.kiwi.com/airlines/64x64/${deal.airline.iataCode}.png`}
                            alt=""
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </span>
                        {deal.airline.name}
                      </span>
                      <span className="text-amber-400">{"★".repeat(deal.airline.skytraxRating)}</span>
                    </div>
                    <p className={`mt-1 ${MUTED_TEXT_CLASS}`}>
                      ab {deal.origin.city} ({deal.origin.iataCode})
                    </p>
                    <p className="text-base font-semibold leading-tight">
                      {deal.destination.city} <span className="font-normal text-slate-500">({deal.destination.iataCode})</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`bg-slate-800 text-slate-400 ${PILL_CLASS}`}>
                        {deal.departureDate ? new Date(deal.departureDate).toLocaleDateString("de-DE") : "Datum flexibel"}
                        {deal.returnDate ? ` – ${new Date(deal.returnDate).toLocaleDateString("de-DE")}` : ""}
                      </span>
                      {deal.nights && (
                        <span className={`bg-slate-800 text-slate-400 ${PILL_CLASS}`}>{deal.nights} Nächte</span>
                      )}
                      {deal.stops != null && (
                        <span className={`bg-slate-800 text-slate-400 ${PILL_CLASS}`}>
                          {deal.stops === 0 ? "Nonstop" : deal.stops === 1 ? "1 Stopp" : `${deal.stops} Stopps`}
                        </span>
                      )}
                    </div>
                    {deal.aircraft && <p className={`mt-1.5 ${MUTED_TEXT_CLASS}`}>{deal.aircraft}</p>}
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">
                        {formatPrice(deal.price, deal.currency)}
                      </p>
                      {deal.discountPercent > 0 && (
                        <p className={`line-through ${MUTED_TEXT_CLASS}`}>
                          {formatPrice(deal.baselinePrice, deal.currency)}
                        </p>
                      )}
                    </div>
                    {deal.discountPercent > 0 ? (
                      <span className={`bg-emerald-500/10 text-emerald-400 ${PILL_CLASS}`}>
                        −{deal.discountPercent.toFixed(0)}%
                      </span>
                    ) : (
                      <span
                        title="Von der Community als Deal kuratiert - noch keine eigene Preishistorie für einen berechneten Vergleichswert"
                        className={`bg-sky-500/10 text-sky-400 ${PILL_CLASS}`}
                      >
                        Community-Deal
                      </span>
                    )}
                  </div>

                  <a
                    href={
                      deal.departureDate
                        ? googleFlightsUrl({
                            origin: deal.origin.iataCode,
                            destination: deal.destination.iataCode,
                            departureDate: deal.departureDate.slice(0, 10),
                            returnDate: deal.returnDate?.slice(0, 10),
                            airlineIata: deal.airline.iataCode,
                          })
                        : deal.clickoutUrl
                    }
                    target="_blank"
                    rel="nofollow sponsored noopener"
                    className="mt-4 block rounded-lg bg-sky-500 px-4 py-2 text-center text-sm font-medium text-slate-950 hover:bg-sky-400"
                  >
                    zu Google Flights
                  </a>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <footer className={`mt-12 border-t border-slate-800 pt-6 text-center ${MUTED_TEXT_CLASS}`}>
        <p>
          Preise sind keine aktuellen Live-Preise - bitte vor Buchung bei Google Flights oder direkt bei der
          Airline prüfen. Duffel hat keine öffentliche Angebotsseite.
        </p>
        <a href="/airlines" className="mt-2 inline-block text-sky-400 hover:underline">
          Airline-Longlist →
        </a>
      </footer>
    </main>
  );
}
