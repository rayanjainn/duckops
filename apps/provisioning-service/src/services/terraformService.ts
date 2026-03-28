import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { createLogger } from "@duckops/shared-utils";

const execAsync = promisify(exec);
const logger = createLogger("terraform-service");

export interface TerraformInput {
  projectName: string;
  namespace: string;
  database: string;
}

export interface TerraformResult {
  namespace: string;
  outputs: Record<string, string>;
}

// __dirname = apps/provisioning-service/src/services → go up 4 levels to repo root
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const TERRAFORM_DIR = path.join(
  REPO_ROOT,
  "infra",
  "terraform",
  "environments",
  process.env.DUCKOPS_ENV === "cloud" ? "cloud" : "local",
);

const TERRAFORM_BIN =
  process.env.TERRAFORM_BIN ||
  "/opt/homebrew/Cellar/terraform/1.5.7/bin/terraform";

// Ensure PATH includes homebrew so subprocesses can find tools
const subEnv = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
  HOME: process.env.HOME || "/tmp",
};

const run = (cmd: string, extraEnv?: Record<string, string>) =>
  execAsync(cmd, {
    cwd: TERRAFORM_DIR,
    env: { ...subEnv, ...extraEnv },
    shell: "/bin/sh",
  });

async function isTerraformAvailable(): Promise<boolean> {
  try {
    await execAsync(`"${TERRAFORM_BIN}" version`, { shell: "/bin/sh", env: subEnv });
    return true;
  } catch {
    return false;
  }
}

export async function runTerraform(input: TerraformInput): Promise<TerraformResult> {
  const { projectName, namespace } = input;

  if (!(await isTerraformAvailable())) {
    logger.warn(`Terraform not installed — skipping infrastructure provisioning for ${projectName}`);
    return { namespace, outputs: {} };
  }

  logger.info(`Running Terraform for project: ${projectName}`);

  const tfVars = {
    TF_VAR_project_name: projectName,
    TF_VAR_namespace: namespace,
    TF_VAR_database: input.database,
  };

  try {
    logger.info("Running terraform init...");
    await run(`"${TERRAFORM_BIN}" init -input=false`, tfVars);

    try {
      await run(`"${TERRAFORM_BIN}" workspace new ${projectName}`, tfVars);
    } catch {
      await run(`"${TERRAFORM_BIN}" workspace select ${projectName}`, tfVars);
    }

    logger.info("Running terraform plan...");
    await run(`"${TERRAFORM_BIN}" plan -input=false -out=tfplan-${projectName}`, tfVars);

    logger.info("Running terraform apply...");
    await run(`"${TERRAFORM_BIN}" apply -input=false -auto-approve tfplan-${projectName}`, tfVars);

    const { stdout } = await run(`"${TERRAFORM_BIN}" output -json`, tfVars);

    let outputs: Record<string, { value: string }> = {};
    try {
      outputs = JSON.parse(stdout);
    } catch {
      // No outputs defined
    }

    const flatOutputs = Object.fromEntries(
      Object.entries(outputs).map(([k, v]) => [k, v.value]),
    );

    logger.info(`Terraform complete for: ${projectName}`);
    return { namespace, outputs: flatOutputs };
  } catch (error: any) {
    logger.error(`Terraform failed for ${projectName}: ${error.message}`);
    throw new Error(`Terraform provisioning failed: ${error.message}`);
  }
}

export async function destroyTerraform(projectName: string): Promise<void> {
  if (!(await isTerraformAvailable())) {
    logger.warn(`Terraform not installed — skipping destroy for ${projectName}`);
    return;
  }

  const tfVars = {
    TF_VAR_project_name: projectName,
    TF_VAR_namespace: `project-${projectName}`,
  };

  try {
    await run(`"${TERRAFORM_BIN}" workspace select ${projectName}`, tfVars);
    await run(`"${TERRAFORM_BIN}" destroy -input=false -auto-approve`, tfVars);
    await run(`"${TERRAFORM_BIN}" workspace select default`, tfVars);
    await run(`"${TERRAFORM_BIN}" workspace delete ${projectName}`, tfVars);
    logger.info(`Terraform resources destroyed for: ${projectName}`);
  } catch (error: any) {
    logger.error(`Terraform destroy failed for ${projectName}: ${error.message}`);
    throw error;
  }
}
