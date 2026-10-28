-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "chatId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "basedOnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "model" TEXT NOT NULL DEFAULT 'claude',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "topP" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "systemPromptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleEnquiry" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "chatId" TEXT,
    "step" TEXT NOT NULL DEFAULT 'make',
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "registration" TEXT,
    "vin" TEXT,
    "mileageKm" INTEGER,
    "fuelType" TEXT,
    "transmission" TEXT,
    "serviceHistory" TEXT,
    "defects" TEXT,
    "askingPriceEur" INTEGER,
    "location" TEXT,
    "sellerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "reference" TEXT,
    "consentAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_tokenHash_key" ON "AccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessToken_visitorId_idx" ON "AccessToken"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeLink_tokenHash_key" ON "ResumeLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ResumeLink_visitorId_idx" ON "ResumeLink"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_slug_key" ON "SystemPrompt"("slug");

-- CreateIndex
CREATE INDEX "SystemPrompt_ownerId_idx" ON "SystemPrompt"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_ownerId_basedOnId_key" ON "SystemPrompt"("ownerId", "basedOnId");

-- CreateIndex
CREATE INDEX "ChatSession_visitorId_updatedAt_idx" ON "ChatSession"("visitorId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleEnquiry_chatId_key" ON "VehicleEnquiry"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleEnquiry_reference_key" ON "VehicleEnquiry"("reference");

-- CreateIndex
CREATE INDEX "VehicleEnquiry_visitorId_idx" ON "VehicleEnquiry"("visitorId");

-- CreateIndex
CREATE INDEX "Attachment_enquiryId_idx" ON "Attachment"("enquiryId");

-- CreateIndex
CREATE INDEX "Attachment_visitorId_idx" ON "Attachment"("visitorId");

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeLink" ADD CONSTRAINT "ResumeLink_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemPrompt" ADD CONSTRAINT "SystemPrompt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemPrompt" ADD CONSTRAINT "SystemPrompt_basedOnId_fkey" FOREIGN KEY ("basedOnId") REFERENCES "SystemPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_systemPromptId_fkey" FOREIGN KEY ("systemPromptId") REFERENCES "SystemPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEnquiry" ADD CONSTRAINT "VehicleEnquiry_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEnquiry" ADD CONSTRAINT "VehicleEnquiry_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "VehicleEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
