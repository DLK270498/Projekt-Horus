import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDeal, type KnownAirline, type KnownAirport } from "./dealExtractor.js";

const airlines: KnownAirline[] = [
  { id: "airline_lh", iataCode: "LH", name: "Lufthansa" },
  { id: "airline_ba", iataCode: "BA", name: "British Airways" },
  { id: "airline_ek", iataCode: "EK", name: "Emirates" },
];

const airports: KnownAirport[] = [
  { id: "airport_fra", iataCode: "FRA", city: "Frankfurt", country: "Germany" },
  { id: "airport_jfk", iataCode: "JFK", city: "New York", country: "USA" },
  { id: "airport_dxb", iataCode: "DXB", city: "Dubai", country: "UAE" },
  { id: "airport_vie", iataCode: "VIE", city: "Vienna", country: "Austria" },
  { id: "airport_hkg", iataCode: "HKG", city: "Hong Kong", country: "Hong Kong" },
];

test("extracts price, route and airline from a typical deal-blog title (EUR)", () => {
  const text = "Lufthansa Business Class Frankfurt (FRA) to New York (JFK) from €1.199 Return";
  const result = extractDeal(text, airlines, airports);

  assert.ok(result);
  assert.equal(result?.price, 1199);
  assert.equal(result?.currency, "EUR");
  assert.equal(result?.originAirportId, "airport_fra");
  assert.equal(result?.destinationAirportId, "airport_jfk");
  assert.equal(result?.airlineId, "airline_lh");
});

test("extracts USD price with dot-decimal format", () => {
  const text = "Emirates Business Class FRA - DXB for $1,450.00 roundtrip";
  const result = extractDeal(text, airlines, airports);

  assert.ok(result);
  assert.equal(result?.price, 1450);
  assert.equal(result?.currency, "USD");
  assert.equal(result?.airlineId, "airline_ek");
});

test("returns null when cabin class is not Business", () => {
  const text = "British Airways Economy Frankfurt (FRA) to New York (JFK) from €399";
  assert.equal(extractDeal(text, airlines, airports), null);
});

test("returns null when fewer than two known airports are present", () => {
  const text = "British Airways Business Class from Frankfurt (FRA) from €1,999";
  assert.equal(extractDeal(text, airlines, airports), null);
});

test("returns null when no price is present", () => {
  const text = "British Airways Business Class Frankfurt (FRA) to New York (JFK), great deal!";
  assert.equal(extractDeal(text, airlines, airports), null);
});

test("still returns a deal with airlineId null when no known airline matches", () => {
  const text = "Unbekannte Airline Business Class Frankfurt (FRA) to Dubai (DXB) for €1.100";
  const result = extractDeal(text, airlines, airports);

  assert.ok(result);
  assert.equal(result?.airlineId, null);
});

test("matches city names, not just IATA codes (real deal-blog format)", () => {
  const text = "Business Class Deal: Frankfurt to Hong Kong 1720€ Round Trip";
  const result = extractDeal(text, airlines, airports);

  assert.ok(result);
  assert.equal(result?.originAirportId, "airport_fra");
  assert.equal(result?.destinationAirportId, "airport_hkg");
});

test("resolves a generic 'Germany' mention to Frankfurt as the default hub", () => {
  const text = "Business Class Deal: Germany to New York 1250€ Round Trip";
  const result = extractDeal(text, airlines, airports);

  assert.ok(result);
  assert.equal(result?.originAirportId, "airport_fra");
  assert.equal(result?.destinationAirportId, "airport_jfk");
});

test("returns null when neither city is in Germany (out of product scope)", () => {
  const text = "Business Class Deal: Vienna to Hong Kong 1260€ Round Trip";
  assert.equal(extractDeal(text, airlines, airports), null);
});
