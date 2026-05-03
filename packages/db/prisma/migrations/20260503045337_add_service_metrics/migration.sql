-- CreateTable
CREATE TABLE "ServiceMetric" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "cpu" DOUBLE PRECISION NOT NULL,
    "memoryBytes" BIGINT NOT NULL,
    "restarts" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceMetric_serviceName_timestamp_idx" ON "ServiceMetric"("serviceName", "timestamp");
