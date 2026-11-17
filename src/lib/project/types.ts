export type ProjectKind = "static" | "vite" | "next" | "react" | "vue" | "svelte" | "angular" | "unknown";

export type ProjectFile = {
  path: string;
  size: number;
  mimeType: string;
};

export type ProjectManifest = {
  id: string;
  name: string;
  kind: ProjectKind;
  entrypoint: string | null;
  files: ProjectFile[];
  importedAt: string;
};

export type RuntimeStatus = "not_configured" | "provisioning" | "running" | "stopped" | "error";
