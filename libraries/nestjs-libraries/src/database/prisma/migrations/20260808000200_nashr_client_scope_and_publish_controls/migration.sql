-- AlterTable
ALTER TABLE "UserOrganization" ADD COLUMN     "nashrCustomerId" TEXT;

-- AlterTable
ALTER TABLE "NashrBrandProfile" ADD COLUMN     "autonomousPublishing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientApprovalRequired" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_nashrCustomerId_fkey" FOREIGN KEY ("nashrCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

