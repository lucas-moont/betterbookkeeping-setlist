-- CreateTable
CREATE TABLE "FailedSignIn" (
    "id" TEXT NOT NULL,
    "emailKey" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailedSignIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedSignIn_emailKey_ip_createdAt_idx" ON "FailedSignIn"("emailKey", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "FailedSignIn_createdAt_idx" ON "FailedSignIn"("createdAt");
