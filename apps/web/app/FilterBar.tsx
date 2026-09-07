"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { FIELD_BG_BORDER } from "./theme";

// Shape-only sizing so every filter control (text input, date field,
// select, button) lines up at the same height - text-base (16px) on
// mobile avoids iOS Safari's auto-zoom-on-focus for any input under
// 16px; sm:text-sm restores the tighter desktop look above the 640px
// breakpoint. Background/border colors are deliberately NOT baked in
// here: Tailwind's generated stylesheet orders utilities by internal
// category, not by where they appear in the source, so a shared class
// carrying e.g. bg-slate-900 could silently outrank a button's own
// bg-sky-500 depending on that ordering - each element below sets its
// own single background/border color instead of layering one on top of
// a shared one.
const FIELD_SHAPE_CLASS = "h-10 shrink-0 rounded-full px-4 text-base placeholder:text-slate-500 sm:text-sm";
const FIELD_CLASS = `${FIELD_SHAPE_CLASS} border ${FIELD_BG_BORDER}`;
const FIELD_TEXT_CLASS = "text-slate-700 dark:text-slate-300";

const HAUL_TYPE_LABELS: Record<string, string> = {
  LONG: "Langstrecke",
  MID: "Mittelstrecke",
  SHORT: "Kurzstrecke",
};

type Airline = { id: string; iataCode: string; name: string };
type Airport = { id: string; iataCode: string; city: string };

export function FilterBar({ airlines, airports }: { airlines: Airline[]; airports: Airport[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const get = (key: string) => searchParams.get(key) ?? undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/?${query}` : "/");
    });
  }

  function handleReset() {
    startTransition(() => {
      router.push("/");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <input
          name="origin"
          list="airport-options"
          placeholder="Von"
          size={4}
          defaultValue={get("origin")}
          className={FIELD_CLASS}
        />
        <input
          name="destination"
          list="airport-options"
          placeholder="Nach"
          size={4}
          defaultValue={get("destination")}
          className={FIELD_CLASS}
        />
        <datalist id="airport-options">
          {airports.map((airport) => (
            <option key={airport.id} value={airport.iataCode}>
              {airport.city}
            </option>
          ))}
        </datalist>

        <div className={`flex items-center gap-1.5 px-3 ${FIELD_CLASS}`}>
          <span className="text-base text-slate-500 sm:text-sm">Ab</span>
          <input
            name="fromDate"
            type="date"
            defaultValue={get("fromDate")}
            className="w-[110px] bg-transparent text-base text-slate-700 dark:text-slate-300 sm:text-sm"
          />
        </div>

        <div className={`flex items-center gap-1.5 px-3 ${FIELD_CLASS}`}>
          <span className="text-base text-slate-500 sm:text-sm">Bis</span>
          <input
            name="toDate"
            type="date"
            defaultValue={get("toDate")}
            className="w-[110px] bg-transparent text-base text-slate-700 dark:text-slate-300 sm:text-sm"
          />
        </div>

        <input
          name="maxPrice"
          type="number"
          placeholder="Budget (€)"
          defaultValue={get("maxPrice")}
          className={`w-28 ${FIELD_CLASS}`}
        />

        <select name="minNights" defaultValue={get("minNights") ?? ""} className={`${FIELD_CLASS} ${FIELD_TEXT_CLASS}`}>
          <option value="">Aufenthalt egal</option>
          <option value="7">≥ 1 Woche</option>
          <option value="14">≥ 2 Wochen</option>
          <option value="21">≥ 3 Wochen</option>
        </select>

        <select name="airline" defaultValue={get("airline") ?? ""} className={`${FIELD_CLASS} max-w-[9rem] truncate ${FIELD_TEXT_CLASS}`}>
          <option value="">Alle Airlines</option>
          {airlines.map((airline) => (
            <option key={airline.id} value={airline.iataCode}>
              {airline.name}
            </option>
          ))}
        </select>

        <select name="minRating" defaultValue={get("minRating") ?? ""} className={`${FIELD_CLASS} ${FIELD_TEXT_CLASS}`}>
          <option value="">Rating egal</option>
          <option value="5">★★★★★+</option>
          <option value="4">★★★★+</option>
          <option value="3">★★★+</option>
        </select>

        <select name="haulType" defaultValue={get("haulType") ?? ""} className={`${FIELD_CLASS} ${FIELD_TEXT_CLASS}`}>
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
          placeholder="Rabatt %"
          defaultValue={get("minDiscount")}
          className={`w-24 ${FIELD_CLASS}`}
        />

        <label className={`flex items-center gap-2 ${FIELD_TEXT_CLASS} ${FIELD_CLASS}`}>
          <input
            type="checkbox"
            name="onlyRealDeals"
            value="true"
            defaultChecked={get("onlyRealDeals") === "true"}
            className="h-4 w-4 rounded border-slate-400 bg-white accent-emerald-500 dark:border-slate-600 dark:bg-slate-900"
          />
          Nur echte Deals
        </label>

        {/* Lets you compare the newest ingestion batch against older data
            before deciding to prune anything - see
            apps/worker/src/index.ts's BATCH_LABEL. */}
        <select name="batch" defaultValue={get("batch") ?? ""} className={`${FIELD_CLASS} max-w-[11rem] truncate ${FIELD_TEXT_CLASS}`}>
          <option value="">Alle Durchläufe</option>
          <option value="maintenance">Nur laufender Preis-Check</option>
          <option value="2026-09-06-valuehubs-v4">Nur neuester Durchlauf (Value-Hubs)</option>
          <option value="2026-09-06-longhaul-v3">Nur vorheriger Durchlauf (Long-Haul)</option>
        </select>

        <button
          type="submit"
          disabled={isPending}
          className={`${FIELD_SHAPE_CLASS} border border-sky-500 bg-sky-500 font-medium text-slate-950 hover:border-sky-400 hover:bg-sky-400 disabled:opacity-80`}
        >
          {isPending ? "Filtert…" : "Filtern"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className={`${FIELD_SHAPE_CLASS} flex items-center border border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200`}
        >
          Zurücksetzen
        </button>
      </div>
      {/* Fade + arrow hint that the row scrolls further right - the filter
          bar overflowed silently before with no visual cue. */}
      <div className="pointer-events-none absolute right-0 top-0 flex h-10 w-10 items-center justify-end bg-gradient-to-l from-white to-transparent text-slate-500 dark:from-slate-950">
        ›
      </div>
    </form>
  );
}
