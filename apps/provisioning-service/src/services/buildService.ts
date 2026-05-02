import { exec } from "child_process";
import { promisify } from "util";
import { createLogger } from "@duckops/shared-utils";

const execAsync = promisify(exec);
const logger = createLogger("build-service");

const IS_CLOUD = process.env.DEPLOY_MODE === "cloud";

// In local mode: k3d registry (two hostnames for in-cluster vs host access)
// In cloud mode: ECR (same URL for both — ECR is reachable from host and K3s)
const K8S_REGISTRY = process.env.REGISTRY_URL || "k3d-duckops-registry:5111";
const HOST_REGISTRY = process.env.HOST_REGISTRY_URL || (IS_CLOUD ? K8S_REGISTRY : "localhost:5111");

const AWS_REGION = process.env.AWS_REGION || "ap-south-1";
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || "";

const subEnv = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
  HOME: process.env.HOME || "/tmp",
};

async function ecrLogin(): Promise<void> {
  const ecrUrl = `${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com`;
  const { stdout: password } = await execAsync(
    `aws ecr get-login-password --region ${AWS_REGION}`,
    { env: subEnv },
  );
  await execAsync(
    `echo "${password.trim()}" | docker login --username AWS --password-stdin ${ecrUrl}`,
    { env: subEnv, shell: "/bin/sh" },
  );
  logger.info(`Logged into ECR: ${ecrUrl}`);
}

async function ensureEcrRepo(projectName: string): Promise<void> {
  const repoName = `duckops/${projectName}`;
  try {
    await execAsync(
      `aws ecr describe-repositories --repository-names ${repoName} --region ${AWS_REGION}`,
      { env: subEnv },
    );
  } catch {
    // Repo doesn't exist — create it
    await execAsync(
      `aws ecr create-repository --repository-name ${repoName} --region ${AWS_REGION} --image-scanning-configuration scanOnPush=true`,
      { env: subEnv },
    );
    logger.info(`Created ECR repo: ${repoName}`);
  }
}

export async function buildAndPushImage(
  projectName: string,
  projectDir: string,
): Promise<string> {
  if (IS_CLOUD) {
    await ecrLogin();
    await ensureEcrRepo(projectName);
  }

  const k8sTag = `${K8S_REGISTRY}/${IS_CLOUD ? "duckops/" : ""}${projectName}:latest`;
  const hostTag = IS_CLOUD ? k8sTag : `${HOST_REGISTRY}/${projectName}:latest`;

  logger.info(`Building Docker image for ${projectName}...`);

  const { stderr: buildErr } = await execAsync(
    `docker build -t ${hostTag} ${projectDir}`,
    { env: subEnv, shell: "/bin/sh" },
  );
  if (buildErr) logger.info(`Build: ${buildErr}`);

  logger.info(`Pushing image to registry...`);

  const { stderr: pushErr } = await execAsync(
    `docker push ${hostTag}`,
    { env: subEnv, shell: "/bin/sh" },
  );
  if (pushErr) logger.info(`Push: ${pushErr}`);

  if (!IS_CLOUD) {
    // Tag with k8s-internal name so manifest references work inside the cluster
    await execAsync(`docker tag ${hostTag} ${k8sTag}`, { env: subEnv, shell: "/bin/sh" }).catch(() => {});
  }

  logger.info(`Image ready: ${k8sTag}`);
  return k8sTag;
}

export async function deleteEcrImage(projectName: string): Promise<void> {
  if (!IS_CLOUD) return;
  const repoName = `duckops/${projectName}`;
  await execAsync(
    `aws ecr delete-repository --repository-name ${repoName} --force --region ${AWS_REGION}`,
    { env: subEnv },
  ).catch((e: Error) => logger.warn(`ECR delete failed: ${e.message}`));
}
