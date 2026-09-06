type Deal = {
  id: string;
  price: number;
  currency: string;
  baselinePrice: number;
  discountPercent: number;
  isRealDeal: boolean;
  cabinClass: string;
  departureDate: string | null;
  clickoutUrl: string;
  clickoutCheckedAt: string | null;
  clickoutIsValid: boolean;
  airline: { iataCode: string; name: string; skytraxRating: number; haulTypes: string[] };
  origin: { iataCode: string; city: string };
  destination: { iataCode: string; city: string };
};

type Airline = { id: string; iataCode: string; name: string };
type Airport = { id: string; iataCode: string; city: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
  };

  const [deals, airlines, airports] = await Promise.all([
    getJson<Deal[]>("/deals", filters),
    getJson<Airline[]>("/airlines"),
    getJson<Airport[]>("/airports"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projekt Horus</h1>
          <p className="mt-1 text-sm text-slate-400">Business Class Deals ex Deutschland</p>
        </div>
        <a href="/airlines" className="text-sm text-sky-400 hover:underline">
          Airline-Longlist →
        </a>
      </header>

      <form
        method="get"
        className="mt-8 grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-3 lg:grid-cols-9"
      >
        <input
          name="origin"
          list="airport-options"
          placeholder="Von (z.B. FRA)"
          defaultValue={filters.origin}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-500"
        />
        <input
          name="destination"
          list="airport-options"
          placeholder="Nach (z.B. JFK)"
          defaultValue={filters.destination}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-500"
        />
        <datalist id="airport-options">
          {airports.map((airport) => (
            <option key={airport.id} value={airport.iataCode}>
              {airport.city}
            </option>
          ))}
        </datalist>

        <select
          name="airline"
          defaultValue={filters.airline ?? ""}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="">Alle Airlines</option>
          {airlines.map((airline) => (
            <option key={airline.id} value={airline.iataCode}>
              {airline.name}
            </option>
          ))}
        </select>

        <select
          name="minRating"
          defaultValue={filters.minRating ?? ""}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="">Rating egal</option>
          <option value="5">★★★★★+</option>
          <option value="4">★★★★+</option>
          <option value="3">★★★+</option>
        </select>

        <select
          name="haulType"
          defaultValue={filters.haulType ?? ""}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="">Haul-Typ egal</option>
          {Object.entries(HAUL_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          name="maxPrice"
          type="number"
          placeholder="Max. Preis (€)"
          defaultValue={filters.maxPrice}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-500"
        />

        <input
          name="minDiscount"
          type="number"
          placeholder="Min. Ersparnis %"
          defaultValue={filters.minDiscount}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-500"
        />

        <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="onlyRealDeals"
            value="true"
            defaultChecked={filters.onlyRealDeals === "true"}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-emerald-500"
          />
          Nur echte Deals
        </label>

        <button
          type="submit"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
        >
          Filtern
        </button>
      </form>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <article
                key={deal.id}
                className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                {deal.isRealDeal && (
                  <span className="absolute right-3 top-3 rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-950 shadow-lg">
                    Deal
                  </span>
                )}
                <div>
                  <div className="flex items-center justify-between pr-16 text-sm text-slate-400">
                    <span>{deal.airline.name}</span>
                    <span>{"★".repeat(deal.airline.skytraxRating)}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold">
                    {deal.origin.city} ({deal.origin.iataCode}) → {deal.destination.city} (
                    {deal.destination.iataCode})
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {deal.cabinClass === "BUSINESS" ? "Business Class" : deal.cabinClass}
                    {deal.departureDate
                      ? ` · ${new Date(deal.departureDate).toLocaleDateString("de-DE")}`
                      : " · Datum flexibel"}
                  </p>
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
                  href={deal.clickoutUrl}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  className="mt-4 block rounded-lg bg-sky-500 px-4 py-2 text-center text-sm font-medium text-slate-950 hover:bg-sky-400"
                >
                  Zum Angebot
                </a>
                <p className="mt-2 text-center text-xs text-slate-500">
                  {deal.clickoutCheckedAt
                    ? `Link geprüft: ${new Date(deal.clickoutCheckedAt).toLocaleString("de-DE")}`
                    : "Link noch nicht auf Aktualität geprüft"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
