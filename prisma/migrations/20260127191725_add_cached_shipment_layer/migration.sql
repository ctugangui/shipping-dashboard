-- CreateTable
CREATE TABLE "cached_shipments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "estimatedDelivery" DATETIME,
    "currentLocation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cached_shipment_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "cached_shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "cached_shipments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_shipments_trackingNumber_key" ON "cached_shipments"("trackingNumber");
