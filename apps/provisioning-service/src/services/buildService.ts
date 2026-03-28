import { exec } from "child_process";
import { promisify } from "util";
import { createLogger } from "@duckops/shared-utils";

const execAsync = promisify(exec);
const logger = createLogger("build-service");

// K8s pulls from this hostname (resolves inside Docker network)
const K8S_REGISTRY = process.env.REGISTRY_URL || "k3d-duckops-registry:5111";
// Host machine pushes to this (localhost resolves on the host)
const HOST_REGISTRY = process.env.HOST_REGISTRY_URL || "localhost:5111";

const subEnv = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
  HOME: process.env.HOME || "/tmp",
};

export async function buildAndPushImage(
  projectName: string,
  projectDir: string,
): Promise<string> {
  const k8sTag = `${K8S_REGISTRY}/${projectName}:latest`;
  const hostTag = `${HOST_REGISTRY}/${projectName}:latest`;

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

  // Also tag with k8s registry name so the manifest references work
  await execAsync(`docker tag ${hostTag} ${k8sTag}`, { env: subEnv, shell: "/bin/sh" }).catch(() => {});

  logger.info(`Image ready: ${k8sTag}`);
  return k8sTag;
}
