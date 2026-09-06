import { googleFlightsUrl } from "./googleFlights";

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

const HAUL_TYPE_LABELS: Record<string, string> = {
  LONG: "Langstrecke",
  MID: "Mittelstrecke",
  SHORT: "Kurzstrecke",
};

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(price);
}

// Shared sizing so every filter control (text input, date field, select,
// button) lines up at the same height instead of drifting by a few px
// depending on each element's default vertical padding. text-base (16px)
// on mobile avoids iOS Safari's auto-zoom-on-focus for any input under
// 16px; sm:text-sm restores the tighter desktop look above the 640px
// breakpoint.
const FIELD_CLASS =
  "h-10 shrink-0 rounded-full border border-slate-700 bg-slate-900 px-4 text-base placeholder:text-slate-500 sm:text-sm";
const PANEL_FIELD_CLASS = "h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base sm:text-sm";

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
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Horus</h1>
            <p className="text-xs text-slate-500">Business Class Deals ex Deutschland</p>
          </div>
        </div>
        <a href="/airlines" className="text-sm text-sky-400 hover:underline">
          Airline-Longlist →
        </a>
      </header>

      <div className="sticky top-0 z-20 mt-8 -mx-6 border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
        <form method="get">
          {/* Primary filters: horizontally scrollable on narrow screens.
              This row must NOT also contain the "Weitere Filter" popover -
              overflow-x-auto implicitly makes overflow-y "auto" too (CSS
              spec quirk), which silently clipped the popover instead of
              showing it, looking like the button did nothing on click. */}
          <div className="relative">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              <input
                name="origin"
                list="airport-options"
                placeholder="Von"
                defaultValue={filters.origin}
                className={`w-24 ${FIELD_CLASS}`}
              />
              <input
                name="destination"
                list="airport-options"
                placeholder="Nach"
                defaultValue={filters.destination}
                className={`w-24 ${FIELD_CLASS}`}
              />
              <datalist id="airport-options">
                {airports.map((airport) => (
                  <option key={airport.id} value={airport.iataCode}>
                    {airport.city}
                  </option>
                ))}
              </datalist>

              <div className={`flex items-center gap-1.5 px-3 ${FIELD_CLASS}`}>
                <span className="text-xs text-slate-500">Ab</span>
                <input
                  name="fromDate"
                  type="date"
                  defaultValue={filters.fromDate}
                  className="w-[110px] bg-transparent text-base text-slate-300 [color-scheme:dark] sm:text-sm"
                />
              </div>

              <div className={`flex items-center gap-1.5 px-3 ${FIELD_CLASS}`}>
                <span className="text-xs text-slate-500">Bis</span>
                <input
                  name="toDate"
                  type="date"
                  defaultValue={filters.toDate}
                  className="w-[110px] bg-transparent text-base text-slate-300 [color-scheme:dark] sm:text-sm"
                />
              </div>

              <input
                name="maxPrice"
                type="number"
                placeholder="Budget (€)"
                defaultValue={filters.maxPrice}
                className={`w-32 ${FIELD_CLASS}`}
              />

              <select name="minNights" defaultValue={filters.minNights ?? ""} className={`${FIELD_CLASS} text-slate-300`}>
                <option value="">Aufenthalt egal</option>
                <option value="7">≥ 1 Woche</option>
                <option value="14">≥ 2 Wochen</option>
                <option value="21">≥ 3 Wochen</option>
              </select>
            </div>
            {/* Fade + arrow hint that the row scrolls further right - the
                filter bar overflowed silently before with no visual cue. */}
            <div className="pointer-events-none absolute right-0 top-0 flex h-10 w-10 items-center justify-end bg-gradient-to-l from-slate-950 to-transparent text-slate-500">
              ›
            </div>
          </div>

          {/* Secondary row: never scrolls, wraps normally if it runs out of
              space, so the "Weitere Filter" popover always has room to
              render without being clipped. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <details className="relative">
              <summary className={`cursor-pointer list-none ${FIELD_CLASS} flex items-center text-slate-300 hover:border-slate-600`}>
                Weitere Filter ⌄
              </summary>
              <div className="absolute left-0 top-full z-30 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
                <select name="airline" defaultValue={filters.airline ?? ""} className={PANEL_FIELD_CLASS}>
                  <option value="">Alle Airlines</option>
                  {airlines.map((airline) => (
                    <option key={airline.id} value={airline.iataCode}>
                      {airline.name}
                    </option>
                  ))}
                </select>

                <select name="minRating" defaultValue={filters.minRating ?? ""} className={PANEL_FIELD_CLASS}>
                  <option value="">Rating egal</option>
                  <option value="5">★★★★★+</option>
                  <option value="4">★★★★+</option>
                  <option value="3">★★★+</option>
                </select>

                <select name="haulType" defaultValue={filters.haulType ?? ""} className={PANEL_FIELD_CLASS}>
                  <option value="">Haul-Typ egal</option>
                  {Object.entries(HAUL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <input
                  name="minDiscount"
                  type="number"
                  placeholder="Min. Ersparnis %"
                  defaultValue={filters.minDiscount}
                  className={`${PANEL_FIELD_CLASS} placeholder:text-slate-500`}
                />

                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name="onlyRealDeals"
                    value="true"
                    defaultChecked={filters.onlyRealDeals === "true"}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-emerald-500"
                  />
                  Nur echte Deals
                </label>

                {/* Lets you compare the newest ingestion batch against
                    older data before deciding to prune anything - see
                    apps/worker/src/index.ts's BATCH_LABEL. */}
                <select name="batch" defaultValue={filters.batch ?? ""} className={PANEL_FIELD_CLASS}>
                  <option value="">Alle Durchläufe</option>
                  <option value="2026-09-06-longhaul-v3">Nur neuer Durchlauf (Long-Haul)</option>
                </select>
              </div>
            </details>

            <button type="submit" className={`${FIELD_CLASS} bg-sky-500 px-5 font-medium text-slate-950 hover:bg-sky-400`}>
              Filtern
            </button>
            <a href="/" className={`${FIELD_CLASS} flex items-center border-transparent text-slate-400 hover:text-slate-200`}>
              Zurücksetzen
            </a>
          </div>
        </form>
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
            <p className="mb-4 text-center text-xs text-slate-500">
              Preise zum Abgleich bei Google Flights - keine echten Buchungsseiten, Duffel hat keine öffentliche Angebotsseite
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => (
                <article
                  key={deal.id}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-slate-700"
                >
                  {deal.isRealDeal && (
                    <span className="absolute right-3 top-3 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg">
                      Deal
                    </span>
                  )}
                  <div>
                    <div className="flex items-center justify-between pr-16 text-sm text-slate-400">
                      <span>{deal.airline.name}</span>
                      <span className="text-amber-400">{"★".repeat(deal.airline.skytraxRating)}</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold leading-tight">
                      {deal.origin.city} ({deal.origin.iataCode}) → {deal.destination.city} (
                      {deal.destination.iataCode})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                        {deal.cabinClass === "BUSINESS" ? "Business Class" : deal.cabinClass}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                        {deal.departureDate ? new Date(deal.departureDate).toLocaleDateString("de-DE") : "Datum flexibel"}
                        {deal.returnDate ? ` – ${new Date(deal.returnDate).toLocaleDateString("de-DE")}` : ""}
                      </span>
                      {deal.nights && (
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">{deal.nights} Nächte</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">
                        {formatPrice(deal.price, deal.currency)}
                      </p>
                      {deal.discountPercent > 0 && (
                        <p className="text-sm text-slate-500 line-through">
                          {formatPrice(deal.baselinePrice, deal.currency)}
                        </p>
                      )}
                    </div>
                    {deal.discountPercent > 0 ? (
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                        −{deal.discountPercent.toFixed(0)}%
                      </span>
                    ) : (
                      <span
                        title="Von der Community als Deal kuratiert - noch keine eigene Preishistorie für einen berechneten Vergleichswert"
                        className="rounded-full bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-400"
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
                    {deal.departureDate ? "Bei Google Flights prüfen" : "Zum Angebot"}
                  </a>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
