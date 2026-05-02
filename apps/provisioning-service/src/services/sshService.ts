import { NodeSSH } from "node-ssh";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("ssh-service");

let sshClient: NodeSSH | null = null;

async function getClient(): Promise<NodeSSH> {
  const host = process.env.EC2_SSH_HOST;
  const keyPath = process.env.EC2_SSH_KEY_PATH;
  const user = process.env.EC2_SSH_USER || "ubuntu";

  if (!host || !keyPath) {
    throw new Error("EC2_SSH_HOST and EC2_SSH_KEY_PATH must be set for cloud mode");
  }

  if (sshClient && sshClient.isConnected()) return sshClient;

  sshClient = new NodeSSH();
  await sshClient.connect({ host, username: user, privateKeyPath: keyPath });
  logger.info(`SSH connected to ${host}`);
  return sshClient;
}

export async function sshExec(command: string): Promise<{ stdout: string; stderr: string }> {
  const client = await getClient();
  const result = await client.execCommand(command);
  if (result.code !== 0 && result.stderr) {
    logger.warn(`ssh exec stderr [${command.slice(0, 60)}]: ${result.stderr}`);
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

export async function ensureLinuxUser(githubUsername: string): Promise<void> {
  // Sanitize: only lowercase alphanumeric and hyphens — prefix with u_ to avoid conflicts
  const linuxUser = `u_${githubUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const { stdout } = await sshExec(`id -u ${linuxUser} 2>/dev/null && echo EXISTS || echo MISSING`);

  if (stdout.includes("EXISTS")) {
    logger.info(`Linux user ${linuxUser} already exists`);
    return;
  }

  await sshExec(`sudo useradd -m -s /bin/false ${linuxUser}`);
  await sshExec(`sudo mkdir -p /home/${linuxUser}/projects /home/${linuxUser}/logs`);
  await sshExec(`sudo chown -R ${linuxUser}:${linuxUser} /home/${linuxUser}`);
  logger.info(`Created Linux user: ${linuxUser}`);
}

export async function createProjectDir(githubUsername: string, projectName: string): Promise<string> {
  const linuxUser = `u_${githubUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const projectDir = `/home/${linuxUser}/projects/${projectName}`;
  await sshExec(`sudo mkdir -p ${projectDir}/{manifests,logs}`);
  await sshExec(`sudo chown -R ${linuxUser}:${linuxUser} ${projectDir}`);
  return projectDir;
}

export async function removeProjectDir(githubUsername: string, projectName: string): Promise<void> {
  const linuxUser = `u_${githubUsername.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const projectDir = `/home/${linuxUser}/projects/${projectName}`;
  await sshExec(`sudo rm -rf ${projectDir}`).catch(() => {});
}

export async function sshKubectl(command: string): Promise<string> {
  const { stdout } = await sshExec(`kubectl ${command}`);
  return stdout;
}
