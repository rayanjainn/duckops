import { NodeSSH } from "node-ssh";
import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("ssh-service");

let sshClient: NodeSSH | null = null;

async function getClient(): Promise<NodeSSH> {
  const host = process.env.EC2_SSH_HOST;
  const keyPath = process.env.EC2_SSH_KEY_PATH;
  const user = process.env.EC2_SSH_USER || "ubuntu";

  if (!host || !keyPath) throw new Error("EC2_SSH_HOST and EC2_SSH_KEY_PATH must be set for cloud mode");

  if (sshClient && sshClient.isConnected()) return sshClient;

  sshClient = new NodeSSH();
  await sshClient.connect({ host, username: user, privateKeyPath: keyPath });
  logger.info(`SSH connected to ${host}`);
  return sshClient;
}

export async function sshExec(command: string): Promise<{ stdout: string; stderr: string }> {
  const client = await getClient();
  const result = await client.execCommand(command);
  return { stdout: result.stdout, stderr: result.stderr };
}
