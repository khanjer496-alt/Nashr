-- CreateEnum
CREATE TYPE "NashrRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'APPROVER', 'CLIENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "NashrApprovalStage" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'CLIENT_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NashrApprovalDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NashrAgentStatus" AS ENUM ('PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED', 'FAILED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "NashrMarket" AS ENUM ('AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'EG', 'JO');

-- AlterTable
ALTER TABLE "UserOrganization" ADD COLUMN     "nashrRole" "NashrRole" NOT NULL DEFAULT 'VIEWER';

-- CreateTable
CREATE TABLE "NashrBrandProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "brandName" TEXT NOT NULL,
    "brandNameAr" TEXT,
    "industry" TEXT NOT NULL,
    "market" "NashrMarket" NOT NULL DEFAULT 'AE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "toneOfVoice" TEXT,
    "targetAudience" TEXT,
    "products" TEXT,
    "offers" TEXT,
    "prohibitedClaims" TEXT,
    "keywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NashrBrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NashrPostApproval" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stage" "NashrApprovalStage" NOT NULL DEFAULT 'DRAFT',
    "decision" "NashrApprovalDecision" NOT NULL DEFAULT 'SUBMITTED',
    "actorId" TEXT,
    "actorRole" "NashrRole",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NashrPostApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NashrAgentActionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userOrgId" TEXT,
    "agentKey" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "status" "NashrAgentStatus" NOT NULL DEFAULT 'PROPOSED',
    "argsDigest" TEXT,
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NashrAgentActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NashrBrandProfile_customerId_key" ON "NashrBrandProfile"("customerId");

-- CreateIndex
CREATE INDEX "NashrBrandProfile_organizationId_idx" ON "NashrBrandProfile"("organizationId");

-- CreateIndex
CREATE INDEX "NashrBrandProfile_deletedAt_idx" ON "NashrBrandProfile"("deletedAt");

-- CreateIndex
CREATE INDEX "NashrPostApproval_postId_idx" ON "NashrPostApproval"("postId");

-- CreateIndex
CREATE INDEX "NashrPostApproval_organizationId_idx" ON "NashrPostApproval"("organizationId");

-- CreateIndex
CREATE INDEX "NashrPostApproval_stage_idx" ON "NashrPostApproval"("stage");

-- CreateIndex
CREATE INDEX "NashrPostApproval_createdAt_idx" ON "NashrPostApproval"("createdAt");

-- CreateIndex
CREATE INDEX "NashrAgentActionLog_organizationId_idx" ON "NashrAgentActionLog"("organizationId");

-- CreateIndex
CREATE INDEX "NashrAgentActionLog_agentKey_idx" ON "NashrAgentActionLog"("agentKey");

-- CreateIndex
CREATE INDEX "NashrAgentActionLog_status_idx" ON "NashrAgentActionLog"("status");

-- CreateIndex
CREATE INDEX "NashrAgentActionLog_createdAt_idx" ON "NashrAgentActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "NashrBrandProfile" ADD CONSTRAINT "NashrBrandProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NashrBrandProfile" ADD CONSTRAINT "NashrBrandProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NashrPostApproval" ADD CONSTRAINT "NashrPostApproval_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NashrPostApproval" ADD CONSTRAINT "NashrPostApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NashrAgentActionLog" ADD CONSTRAINT "NashrAgentActionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NashrAgentActionLog" ADD CONSTRAINT "NashrAgentActionLog_userOrgId_fkey" FOREIGN KEY ("userOrgId") REFERENCES "UserOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

