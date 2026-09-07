type Airline = {
  id: string;
  iataCode: string;
  name: string;
  homeCountry: string;
  skytraxRating: number;
  haulTypes: string[];
};

async function getAirlines(): Promise<Airline[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${apiUrl}/airlines`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load airlines: ${res.status}`);
  }

  return res.json();
}

export default async function HomePage() {
  const airlines = await getAirlines();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <a href="/" className="text-sm text-sky-600 hover:underline dark:text-sky-400">
        ← zur Deal-Liste
      </a>
      <h1 className="mt-4 text-2xl font-semibold">Airline-Longlist (Debug)</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        Rohdaten aus der Datenbank ({airlines.length} Airlines) zur Verifikation der
        Datenbasis.
      </p>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th className="py-2 pr-4">IATA</th>
            <th className="py-2 pr-4">Airline</th>
            <th className="py-2 pr-4">Heimatland</th>
            <th className="py-2 pr-4">Skytrax</th>
            <th className="py-2 pr-4">Haul-Typen</th>
          </tr>
        </thead>
        <tbody>
          {airlines.map((airline) => (
            <tr key={airline.id} className="border-b border-slate-100 dark:border-slate-900">
              <td className="py-2 pr-4 font-mono">{airline.iataCode}</td>
              <td className="py-2 pr-4">{airline.name}</td>
              <td className="py-2 pr-4">{airline.homeCountry}</td>
              <td className="py-2 pr-4">{"★".repeat(airline.skytraxRating)}</td>
              <td className="py-2 pr-4">{airline.haulTypes.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
