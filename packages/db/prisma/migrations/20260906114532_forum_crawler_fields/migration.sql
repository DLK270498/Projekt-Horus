-- AlterTable
ALTER TABLE "price_observations" ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "departureDate" DROP NOT NULL;
