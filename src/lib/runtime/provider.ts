import type { RuntimeStatus } from "@/lib/project/types";

/**
 * Contract for an isolated project runtime.
 * Implementations must execute untrusted project code outside the StudioForge app process,
 * with per-workspace filesystem, network and resource boundaries.
 */
export interface RuntimeProvider {
  readonly name: string;
  createWorkspace(input: { projectId: string; files: AsyncIterable<{ path: string; content: Uint8Array }> }): Promise<{ workspaceId: string }>;
  installDependencies(workspaceId: string): Promise<void>;
  startDevServer(workspaceId: string): Promise<{ previewUrl: string }>;
  getLogs(workspaceId: string): AsyncIterable<string>;
  getStatus(workspaceId: string): Promise<RuntimeStatus>;
  stop(workspaceId: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export function getRuntimeProvider(): RuntimeProvider | null {
  // Deliberately no fake local execution fallback. A provider must be explicitly integrated.
  return null;
}
