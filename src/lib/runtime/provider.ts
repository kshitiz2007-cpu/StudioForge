import type { RuntimeStatus } from "@/lib/project/types";

export type RuntimeWorkspace = {
  workspaceId: string;
  projectId: string;
  previewUrl: string;
  status: RuntimeStatus;
  createdAt: string;
};

export type RuntimeLimits = {
  cpuMillis: number;
  memoryMb: number;
  diskMb: number;
  maxProcesses: number;
  startupTimeoutSeconds: number;
  idleTimeoutSeconds: number;
  networkPolicy: "deny-by-default" | "restricted";
};

export type RuntimeLogEvent = {
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  message: string;
};

/**
 * Runtime implementations execute untrusted project code outside the StudioForge
 * application process. Provider implementations must enforce per-workspace limits,
 * tenant isolation, network egress policy and deterministic cleanup.
 */
export interface RuntimeProvider {
  readonly name: string;
  readonly isolation: "browser-sandbox" | "container" | "microvm";
  readonly capabilities: {
    node: boolean;
    serverSideRendering: boolean;
    websocketPreview: boolean;
    terminalInput: boolean;
  };
  createWorkspace(input: {
    projectId: string;
    files: AsyncIterable<{ path: string; content: Uint8Array }>;
    limits: RuntimeLimits;
  }): Promise<{ workspaceId: string }>;
  installDependencies(workspaceId: string, input: { packageManager: "npm" | "pnpm" | "yarn" | "bun" }): Promise<void>;
  startDevServer(workspaceId: string, input: { command: string; args: string[]; port: number }): Promise<{ previewUrl: string }>;
  getLogs(workspaceId: string, options?: { after?: string }): AsyncIterable<RuntimeLogEvent>;
  getStatus(workspaceId: string): Promise<RuntimeStatus>;
  stop(workspaceId: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export const DEFAULT_RUNTIME_LIMITS: RuntimeLimits = {
  cpuMillis: 1000,
  memoryMb: 2048,
  diskMb: 4096,
  maxProcesses: 64,
  startupTimeoutSeconds: 180,
  idleTimeoutSeconds: 30 * 60,
  networkPolicy: "deny-by-default",
};

export function getRuntimeProvider(): RuntimeProvider | null {
  const providerName = process.env.STUDIOFORGE_RUNTIME_PROVIDER?.trim().toLowerCase();
  // No provider is implicitly trusted or enabled by an environment string alone.
  // Add a reviewed implementation here only after isolation and lifecycle tests exist.
  if (!providerName || providerName === "none") return null;
  return null;
}
