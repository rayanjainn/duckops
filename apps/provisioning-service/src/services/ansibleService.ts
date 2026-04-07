import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { createLogger } from "@duckops/shared-utils";

const execAsync = promisify(exec);
const logger = createLogger("ansible-service");

export interface AnsibleInput {
  projectName: string;
  namespace: string;
}

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ANSIBLE_DIR = path.join(REPO_ROOT, "infra", "ansible");
const INVENTORY =
  process.env.DUCKOPS_ENV === "cloud"
    ? "inventory/cloud.yml"
    : "inventory/local.yml";

const ANSIBLE_BIN =
  process.env.ANSIBLE_BIN ||
  "/opt/homebrew/Cellar/ansible/13.4.0_1/libexec/bin/ansible-playbook";

const subEnv = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
  HOME: process.env.HOME || "/tmp",
};

async function isAnsibleAvailable(): Promise<boolean> {
  try {
    await execAsync(`"${ANSIBLE_BIN}" --version`, { shell: "/bin/sh", env: subEnv });
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

  const extraVars = JSON.stringify({
    project_name: projectName,
    k8s_namespace: namespace,
    database_url: `postgresql://duckops:duckops123@postgres.${namespace}.svc.cluster.local:5432/${projectName}`,
  });

  try {
    const { stdout, stderr } = await execAsync(
      `"${ANSIBLE_BIN}" playbooks/deploy-app.yml -i ${INVENTORY} --extra-vars '${extraVars}' --connection=local`,
      { cwd: ANSIBLE_DIR, shell: "/bin/sh", env: subEnv },
    );

    if (stdout) logger.info(`Ansible stdout: ${stdout}`);
    if (stderr) logger.warn(`Ansible stderr: ${stderr}`);

    logger.info(`Ansible complete for: ${projectName}`);
  } catch (error: any) {
    logger.error(`Ansible failed for ${projectName}: ${error.message}`);
    throw new Error(`Ansible configuration failed: ${error.message}`);
  }
}
