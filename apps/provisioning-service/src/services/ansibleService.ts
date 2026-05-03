import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createLogger } from "@duckops/shared-utils";

const execAsync = promisify(exec);
const logger = createLogger("ansible-service");

export interface AnsibleInput {
  projectName: string;
  namespace: string;
  databaseUrl?: string;
  isCloud?: boolean;
  githubUsername?: string;
  platformDomain?: string;
}

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ANSIBLE_DIR = path.join(REPO_ROOT, "infra", "ansible");
const INVENTORY =
  process.env.DUCKOPS_ENV === "cloud"
    ? "inventory/cloud.yml"
    : "inventory/local.yml";

const ANSIBLE_BIN =
  process.env.ANSIBLE_BIN ||
  ["/opt/homebrew/bin/ansible-playbook", "/usr/local/bin/ansible-playbook", "/usr/bin/ansible-playbook"]
    .find((p) => { try { require("fs").accessSync(p); return true; } catch { return false; } }) ||
  "ansible-playbook";

const subEnv = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
  HOME: process.env.HOME || "/tmp",
};

async function isAnsibleAvailable(): Promise<boolean> {
  try {
    await execAsync(`${ANSIBLE_BIN} --version`, { shell: "/bin/sh", env: subEnv });
    return true;
  } catch {
    return false;
  }
}

export async function runAnsible(input: AnsibleInput): Promise<void> {
  const { projectName, namespace } = input;

  if (!(await isAnsibleAvailable())) {
    logger.warn(`Ansible not installed — skipping configuration for ${projectName}`);
    return;
  }

  logger.info(`Running Ansible for project: ${projectName}`);

  // Validate inputs: project names must be slugs (alphanumeric + hyphens)
  const safeName = projectName.replace(/[^a-z0-9-]/g, "");
  const safeNamespace = namespace.replace(/[^a-z0-9-]/g, "");

  // Get ECR token if in cloud mode
  let ecrToken = "";
  const isCloud = input.isCloud ?? process.env.DEPLOY_MODE === "cloud";
  const registry = `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com`;

  if (isCloud) {
    try {
      const { stdout: token } = await execAsync(`aws ecr get-login-password --region ${process.env.AWS_REGION || "ap-south-1"}`, { env: subEnv });
      ecrToken = token.trim();
    } catch (e: any) {
      logger.warn(`Failed to get ECR token for Ansible: ${e.message}`);
    }
  }

  // Pass extra-vars via a temp file using @<file> syntax to avoid shell injection.
  const tmpVars = path.join(os.tmpdir(), `duckops-ansible-${safeName}-${Date.now()}.json`);
  await fs.writeFile(
    tmpVars,
    JSON.stringify({
      project_name: safeName,
      k8s_namespace: safeNamespace,
      database_url: input.databaseUrl || `postgresql://duckops:duckops123@postgres.${safeNamespace}.svc.cluster.local:5432/${safeName}`,
      is_cloud: isCloud,
      ecr_registry: registry,
      ecr_token: ecrToken,
      github_username: input.githubUsername || "duckops",
      platform_domain: input.platformDomain || process.env.DOMAIN || "yourdomain.tech",
    }),
    { mode: 0o600 },
  );

  try {
    const { stdout, stderr } = await execAsync(
      `${ANSIBLE_BIN} playbooks/deploy-app.yml -i ${INVENTORY} --extra-vars @${tmpVars} --connection=local`,
      { cwd: ANSIBLE_DIR, shell: "/bin/sh", env: subEnv },
    );

    if (stdout) logger.info(`Ansible stdout: ${stdout}`);
    if (stderr) logger.warn(`Ansible stderr: ${stderr}`);

    logger.info(`Ansible complete for: ${safeName}`);
  } catch (error: any) {
    logger.error(`Ansible failed for ${safeName}: ${error.message}`);
    throw new Error(`Ansible configuration failed: ${error.message}`);
  } finally {
    await fs.rm(tmpVars, { force: true });
  }
}
