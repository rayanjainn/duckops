-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "Layer" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'DATABASE', 'ORM');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('INITIALIZING', 'SCAFFOLDING', 'CREATING_REPO', 'PROVISIONING', 'CONFIGURING', 'PIPELINE_READY', 'DEPLOYING', 'RUNNING', 'DEGRADED', 'STOPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('CREATING', 'ACTIVE', 'PAUSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'BUILDING', 'PUSHING', 'DEPLOYING', 'SUCCESS', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'TIMEOUT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DEVELOPER',
    "githubId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "githubAccessToken" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateOption" (
    "id" TEXT NOT NULL,
    "layer" "Layer" NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "version" TEXT NOT NULL,
    "compatibleWith" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "database" TEXT NOT NULL,
    "orm" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'INITIALIZING',
    "statusMessage" TEXT,
    "namespace" TEXT,
    "liveUrl" TEXT,
    "internalPort" INTEGER,
    "externalPort" INTEGER,
    "githubRepoUrl" TEXT,
    "githubRepoName" TEXT,
    "githubRepoFullName" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jenkinsJobName" TEXT NOT NULL,
    "jenkinsJobUrl" TEXT,
    "gitRepoUrl" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "status" "PipelineStatus" NOT NULL DEFAULT 'CREATING',
    "lastBuildNumber" INTEGER,
    "lastBuildStatus" TEXT,
    "lastBuildAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "imageTag" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT NOT NULL,
    "buildLogs" TEXT,
    "deployLogs" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "responseTime" INTEGER,
    "statusCode" INTEGER,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateOption_layer_name_key" ON "TemplateOption"("layer", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_projectId_key" ON "Pipeline"("projectId");

-- CreateIndex
CREATE INDEX "HealthCheck_projectId_checkedAt_idx" ON "HealthCheck"("projectId", "checkedAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
