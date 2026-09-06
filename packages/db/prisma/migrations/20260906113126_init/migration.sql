-- CreateEnum
CREATE TYPE "HaulType" AS ENUM ('SHORT', 'MID', 'LONG');

-- CreateEnum
CREATE TYPE "CabinClass" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('SCRAPER', 'FORUM', 'MANUAL');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('CANDIDATE', 'PUBLISHED', 'EXPIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "airlines" (
    "id" TEXT NOT NULL,
    "iataCode" TEXT NOT NULL,
    "icaoCode" TEXT,
    "name" TEXT NOT NULL,
    "homeCountry" TEXT NOT NULL,
    "skytraxRating" INTEGER NOT NULL,
    "haulTypes" "HaulType"[],
    "businessClassProductName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airports" (
    "id" TEXT NOT NULL,
    "iataCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_observations" (
    "id" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "originAirportId" TEXT NOT NULL,
    "destinationAirportId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "cabinClass" "CabinClass" NOT NULL DEFAULT 'BUSINESS',
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "rawPayload" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "priceObservationId" TEXT NOT NULL,
    "baselinePrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'CANDIDATE',
    "clickoutUrl" TEXT NOT NULL,
    "clickoutCheckedAt" TIMESTAMP(3),
    "clickoutIsValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originAirportId" TEXT,
    "destinationRegion" TEXT,
    "maxPrice" DECIMAL(10,2),
    "haulTypes" "HaulType"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "airlines_iataCode_key" ON "airlines"("iataCode");

-- CreateIndex
CREATE UNIQUE INDEX "airports_iataCode_key" ON "airports"("iataCode");

-- CreateIndex
CREATE UNIQUE INDEX "sources_name_key" ON "sources"("name");

-- CreateIndex
CREATE INDEX "price_observations_airlineId_originAirportId_destinationAir_idx" ON "price_observations"("airlineId", "originAirportId", "destinationAirportId", "cabinClass");

-- CreateIndex
CREATE UNIQUE INDEX "deals_priceObservationId_key" ON "deals"("priceObservationId");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "airlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_priceObservationId_fkey" FOREIGN KEY ("priceObservationId") REFERENCES "price_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "airports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
