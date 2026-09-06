import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDeal, type KnownAirline, type KnownAirport } from "./dealExtractor.js";

const airlines: KnownAirline[] = [
  { id: "airline_lh", iataCode: "LH", name: "Lufthansa" },
  { id: "airline_ba", iataCode: "BA", name: "British Airways" },
  { id: "airline_ek", iataCode: "EK", name: "Emirates" },
];

const airports: KnownAirport[] = [
  { id: "airport_fra", iataCode: "FRA" },
  { id: "airport_jfk", iataCode: "JFK" },
  { id: "airport_dxb", iataCode: "DXB" },
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

test("returns null when fewer than two known airport codes are present", () => {
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
