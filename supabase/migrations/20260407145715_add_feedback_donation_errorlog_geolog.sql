
-- Enums
CREATE TYPE "public"."FeedbackCategory" AS ENUM ('BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL', 'OTHER');
CREATE TYPE "public"."FeedbackStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "public"."ErrorSource" AS ENUM ('CLIENT', 'SERVER', 'API');
CREATE TYPE "public"."ErrorLevel" AS ENUM ('WARNING', 'ERROR', 'CRITICAL');

-- Add FEEDBACK_REPLY to NotificationType
ALTER TYPE "public"."NotificationType" ADD VALUE IF NOT EXISTS 'FEEDBACK_REPLY';

-- Feedback table
CREATE TABLE "public"."Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "category" "public"."FeedbackCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "status" "public"."FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- FeedbackReply table
CREATE TABLE "public"."FeedbackReply" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackReply_pkey" PRIMARY KEY ("id")
);

-- DonationAddress table
CREATE TABLE "public"."DonationAddress" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DonationAddress_pkey" PRIMARY KEY ("id")
);

-- ErrorLog table
CREATE TABLE "public"."ErrorLog" (
    "id" TEXT NOT NULL,
    "source" "public"."ErrorSource" NOT NULL,
    "level" "public"."ErrorLevel" NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- UserGeoLog table
CREATE TABLE "public"."UserGeoLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "city" TEXT,
    "region" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserGeoLog_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."FeedbackReply" ADD CONSTRAINT "FeedbackReply_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "public"."Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."UserGeoLog" ADD CONSTRAINT "UserGeoLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Feedback_userId_idx" ON "public"."Feedback"("userId");
CREATE INDEX "Feedback_status_idx" ON "public"."Feedback"("status");
CREATE INDEX "Feedback_category_idx" ON "public"."Feedback"("category");
CREATE INDEX "Feedback_createdAt_idx" ON "public"."Feedback"("createdAt");
CREATE INDEX "FeedbackReply_feedbackId_idx" ON "public"."FeedbackReply"("feedbackId");
CREATE INDEX "DonationAddress_isActive_idx" ON "public"."DonationAddress"("isActive");
CREATE INDEX "ErrorLog_source_idx" ON "public"."ErrorLog"("source");
CREATE INDEX "ErrorLog_level_idx" ON "public"."ErrorLog"("level");
CREATE INDEX "ErrorLog_createdAt_idx" ON "public"."ErrorLog"("createdAt");
CREATE INDEX "ErrorLog_userId_idx" ON "public"."ErrorLog"("userId");
CREATE INDEX "UserGeoLog_userId_idx" ON "public"."UserGeoLog"("userId");
CREATE INDEX "UserGeoLog_countryCode_idx" ON "public"."UserGeoLog"("countryCode");
CREATE INDEX "UserGeoLog_createdAt_idx" ON "public"."UserGeoLog"("createdAt");
;
