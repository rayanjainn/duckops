-- AlterEnum
ALTER TYPE "Layer" ADD VALUE 'PACKAGE_MANAGER';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "packageManager" TEXT NOT NULL DEFAULT 'npm';
